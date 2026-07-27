import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import VoiceRoomView from "@/components/irc/VoiceRoomView";
import { ChatClient } from "@/lib/irc/chat-client";
import type { ChannelState, ChatMessage, ChannelCategory } from "@/lib/chat/domain/types";
import { extractImageUrl, extractImageUrls, getAttachmentMarker } from "@/lib/chat/domain/parsers";
import ChannelList from "@/components/irc/ChannelList";
import UserList from "@/components/irc/UserList";
import MessageList from "@/components/irc/MessageList";
import MessageInput from "@/components/irc/MessageInput";
import TypingIndicator from "@/components/irc/TypingIndicator";
import JoinChannelModal from "@/components/irc/JoinChannelModal";
import NickPromptModal from "@/components/irc/NickPromptModal";
import EditChannelDescriptionModal from "@/components/irc/EditChannelDescriptionModal";
import NotificationSettingsModal from "@/components/irc/NotificationSettingsModal";
import ManageMembersModal from "@/components/irc/ManageMembersModal";
import ForwardModal from "@/components/irc/ForwardModal";
import Drawer from "@/components/irc/Drawer";
import FloatingVideoContainer from "@/components/irc/FloatingVideo";
import { useFloatingVideo } from "@/hooks/useFloatingVideo";
import { useToasts } from "@/hooks/useToasts";
import { ensureNotificationAudio, playMentionBeep, playBuzz, setVolume } from "@/lib/notification-sound";
import { formatToast, showSystemNotification, useRequestNotificationPermission } from "@/lib/chat-notifs";
import { useHeaderOffset } from "@/hooks/use-header-offset";
import { api as mfApi, clearSsoBudget, getSessionId, logout, onAuthFatal } from "@/lib/chat/session-api";
import { takeSnapshot } from "@/lib/session-debug";
import { getOrCreateAudioContext, resumeAudioContext } from "@/voice/audioContext";
import { Topbar } from "./Topbar";

const CHANNEL_KEY = "chat.channel";

export function Irc() {
  useEffect(() => {
    document.title = "chat · late.kodingvibes.com";
  }, []);
  useRequestNotificationPermission();
  const radioCurrent = typeof window !== "undefined"
    ? window.RadioEngine?.getState().current ?? null
    : null;

  const { headerHeight, vh } = useHeaderOffset();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unlock = () => {
      ensureNotificationAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [hasMore, setHasMore] = useState<Record<number, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNickModal, setShowNickModal] = useState(false);
  const [showChannelsDrawer, setShowChannelsDrawer] = useState(false);
  const [showUsersDrawer, setShowUsersDrawer] = useState(false);
  const [showEditTopic, setShowEditTopic] = useState(false);
  const [buzzShake, setBuzzShake] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const tokenInvalidRef = useRef(false);
  const [nick, setNick] = useState("");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [googleName, setGoogleName] = useState<string | null>(null);
  // ponytail: global_role comes from the late-auth /validate
  // response. We need it here to know whether the local user is
  // super_admin / admin on every channel so we can surface the
  // "Edit topic" affordance in the topbar even before any per-
  // channel role row exists.
  const [globalRole, setGlobalRole] = useState<string>("user");
  const {
    floatingVideo,
    floatingContainerRef,
    closeFloatingVideo,
    handleVideoRef,
    handleVideoPlay,
    handleVideoFloat,
    maybeFloatOnChannelSwitch,
  } = useFloatingVideo();
  // Debounce online-count refreshes so a burst of messages in
  // a busy channel doesn't fire N REST calls.
  const onlineRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nickMap, setNickMap] = useState<Map<number, string>>(new Map());
  const [typing, setTyping] = useState<Map<number, number>>(new Map())
  const [replyContext, setReplyContext] = useState<ChatMessage | null>(null)
  const [editContext, setEditContext] = useState<ChatMessage | null>(null)
  const [forwardContext, setForwardContext] = useState<ChatMessage | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [managingChannelId, setManagingChannelId] = useState<number | null>(null)
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<number | null>(null)
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [notifPrefs, setNotifPrefs] = useState<{ mode: 'mentions' | 'all' | 'none'; volume: number; sound: boolean; vibration: boolean; system: boolean }>(() => {
    try {
      const saved = localStorage.getItem('chat.notif_prefs')
      if (saved) return { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true, ...JSON.parse(saved) }
    } catch {}
    return { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true }
  })
  const notifPrefsRef = useRef(notifPrefs)
  useEffect(() => { notifPrefsRef.current = notifPrefs }, [notifPrefs])
  const [channels, setChannels] = useState<Map<number, ChannelState>>(new Map());
  const [currentChannel, setCurrentChannel] = useState<number | null>(() => {
    const v = localStorage.getItem(CHANNEL_KEY);
    return v ? Number(v) : null;
  });
  const currentChan = currentChannel !== null ? channels.get(currentChannel) : null;
  const { toasts, pushToast, clearToasts, dismissToast } = useToasts();
  const clientRef = useRef<ChatClient | null>(null);
  const messageInputRef = useRef<{ focus: () => void; insertText: (text: string) => void } | null>(null);
  const voiceHandlersRef = useRef<Set<(type: string, data: any) => void>>(new Set())
  const voiceCleanupRef = useRef<(() => void) | null>(null)

  const emitVoiceMessage = useCallback((type: string, data: any) => {
    voiceHandlersRef.current.forEach(h => h(type, data))
  }, [])

  const onVoiceMessage = useCallback((handler: (type: string, data: any) => void): (() => void) => {
    voiceHandlersRef.current.add(handler)
    return () => { voiceHandlersRef.current.delete(handler) }
  }, [])
  const myUserIdRef = useRef<number | null>(null)
  const nickRef = useRef<string>("")
  const channelsRef = useRef<Map<number, ChannelState>>(new Map())
  useEffect(() => { myUserIdRef.current = myUserId }, [myUserId])
  useEffect(() => { nickRef.current = nick }, [nick])
  useEffect(() => { channelsRef.current = channels }, [channels])
  useEffect(() => { tokenInvalidRef.current = tokenInvalid }, [tokenInvalid])

  useEffect(() => {
    return onAuthFatal(() => setTokenInvalid(true))
  }, [])

  useEffect(() => {
    if (!tokenInvalid) return
    logout()
  }, [tokenInvalid])

  useEffect(() => {
    const tick = () => {
      setTyping(prev => {
        const now = Date.now()
        const next = new Map<number, number>()
        let changed = false
        for (const [id, t] of prev) {
          if (now - t < 6000) next.set(id, t)
          else changed = true
        }
        return changed ? next : prev
      })
    }
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (currentChannel !== null) {
      localStorage.setItem(CHANNEL_KEY, String(currentChannel));
    }
    setTyping(new Map())
  }, [currentChannel]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refreshOnline.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [])

  // Sync online count from the socket — every new message
  // bumps last_seen on the server, so re-fetching the channel
  // list + members after each event keeps the Topbar badge and
  // the UserList in sync without polling.
  const refreshOnline = useRef(() => {
    const c = clientRef.current
    if (!c) return
    c.refreshChannels().catch(() => {})
    const id = c.getCurrentChannel()
    if (id !== null) c.loadMembers(id).catch(() => {})
  })
  const scheduleOnlineRefresh = useRef(() => {
    if (onlineRefreshTimerRef.current) return
    onlineRefreshTimerRef.current = setTimeout(() => {
      onlineRefreshTimerRef.current = null
      refreshOnline.current()
    }, 5000)
  })

  useEffect(() => {
    let cancelled = false;
    // The shell installs window.LateSession during its first render of
    // /irc. The MF bundle may mount before that happens (scripts load in
    // parallel). Poll briefly so we don't race the shell.
    let unsubKicked: (() => void) | undefined;

    const begin = (sid: string) => {
      const startChat = async (sid: string) => {
        if (cancelled) return
        const client = new ChatClient(sid)
      clientRef.current = client
      client.onState((state) => {
        if (clientRef.current !== client) return
        if (state.connected !== undefined) {
          setConnected(state.connected)
          if (state.connected) clearSsoBudget()
        }
        if (state.tokenInvalid) setTokenInvalid(true)
        if (client.nickByUserId.size > 0) {
          setNickMap(new Map(client.nickByUserId))
        }
        if (state.user !== undefined) {
          setNick(state.user?.display_name || "")
          setMyUserId(state.user?.id ?? null)
          setGoogleName(state.user?.name || null)
          setGlobalRole(state.user?.global_role ?? "user")
          if (
            state.user?.display_name &&
            state.user.display_name === state.user.email.split("@")[0] &&
            !localStorage.getItem("chat.nick_prompted")
          ) {
            setShowNickModal(true)
            localStorage.setItem("chat.nick_prompted", "1")
          }
        }
        if (state.channels !== undefined) setChannels(new Map(state.channels))
        if (state.currentChannel !== undefined) setCurrentChannel(state.currentChannel)
      })
      client.onMessage((msg: ChatMessage) => {
        if (clientRef.current !== client) return
        if (msg.user_id === myUserIdRef.current) return
        scheduleOnlineRefresh.current()
        setTyping(prev => {
          if (!prev.has(msg.user_id)) return prev
          const next = new Map(prev)
          next.delete(msg.user_id)
          return next
        })
        const prefs = notifPrefsRef.current
        const ch = channelsRef.current.get(msg.channel_id)
        const channelName = ch?.name
        const toast = formatToast(msg, myUserIdRef.current, nickRef.current, channelName)
        if (prefs.mode === 'all') {
          const where = channelName ? ` en ${channelName}` : ''
          pushToast(`${msg.display_name}${where}: ${msg.content.slice(0, 80)}`, 'join')
        } else if (prefs.mode === 'mentions' && toast?.type === 'mention') {
          pushToast(toast.text, toast.type, { sticky: true })
          if (prefs.sound) playMentionBeep()
        } else if (prefs.mode === 'mentions' && toast) {
          pushToast(toast.text, toast.type, { sticky: true })
        }
        if (toast?.type === 'mention' && document.hidden && prefs.system) {
          showSystemNotification(
            `${msg.display_name} te mencionó en #${(channelName || '').replace(/^#/, '')}`,
            msg.content,
          )
        }
      })
      client.onTyping((data) => {
        if (clientRef.current !== client) return
        if (data.channel_id !== currentChannel) return
        if (data.user_id === myUserIdRef.current) return
        setTyping(prev => {
          const next = new Map(prev)
          if (data.typing) {
            next.set(data.user_id, Date.now())
          } else {
            next.delete(data.user_id)
          }
          return next
        })
      })
      client.onBuzz((data) => {
        if (clientRef.current !== client) return
        const isMine = data.from_user_id === myUserIdRef.current
        playBuzz(notifPrefsRef.current.volume)
        setBuzzShake(true)
        setTimeout(() => setBuzzShake(false), 600)
        if (notifPrefsRef.current.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 200])
        }
        if (!isMine) {
          const ch = channelsRef.current.get(data.channel_id)
          const chName = ch?.name ? ch.name.replace(/^#/, '') : null
          const where = chName ? ` en #${chName}` : ''
          pushToast(`🔔 ${data.from_display_name} te está zumbando${where}`, 'mention', { autoCloseMs: 60000 })
        }
      })
      client.onMemberMuted((data) => {
        if (clientRef.current !== client) return
        if (data.user_id === myUserIdRef.current) {
          const ch = channelsRef.current.get(data.channel_id)
          const label = data.muted ? 'silenciado' : 'desilenciado'
          pushToast(`Te han ${label} en ${ch?.name || '#canal'}`, 'mention')
        }
      })
      client.onAuthFatal(() => {
        if (cancelled) return
        // The shell owns auth: setTokenInvalid flips tokenInvalid and the
        // outer effect calls logout(), which clears the session and
        // reloads. The shell then shows its own login UI.
        setTokenInvalid(true)
        setLoading(false)
      })
      try {
        await client.start()
        client.listCategories().then(cats => setCategories(cats)).catch(() => {})
        const unsubVoice = client.onVoiceMessage((type, data) => {
          emitVoiceMessage(type, data)
        })
        voiceCleanupRef.current = unsubVoice
        setLoading(false)
        const savedCh = localStorage.getItem(CHANNEL_KEY)
        const targetId = savedCh ? Number(savedCh) : null
        const ch = targetId !== null ? client.channels.get(targetId) : null
        const finalId = ch ? targetId : (Array.from(client.channels.values())[0]?.id ?? null)
        if (finalId !== null) {
          await client.setCurrentChannel(finalId)
          await client.loadMembers(finalId)
        }
      } catch (err: any) {
        if (cancelled) return
        setLoading(false)
        if (tokenInvalidRef.current) return
        // Non-auth connect failure: keep the loader in place; the
        // ChatClient handles its own reconnect/backoff.
      }
    }
    startChat(sid).catch(() => {})

    unsubKicked = onVoiceMessage((type, _data) => {
      if (type === 'kicked') {
        setActiveVoiceChannelId(null)
      }
    })
    }

    const sid = getSessionId();
    if (sid) {
      begin(sid);
    } else {
      let tries = 0;
      const id = setInterval(() => {
        if (cancelled) return;
        const s = getSessionId();
        if (s) {
          clearInterval(id);
          begin(s);
        } else if (++tries > 50) {
          clearInterval(id);
          setLoading(false);
        }
      }, 100);
      return () => { cancelled = true; clearInterval(id); };
    }
    return () => {
      cancelled = true
      unsubKicked?.()
      if (voiceCleanupRef.current) {
        voiceCleanupRef.current()
        voiceCleanupRef.current = null
      }
      clearToasts()
      if (onlineRefreshTimerRef.current) {
        clearTimeout(onlineRefreshTimerRef.current)
        onlineRefreshTimerRef.current = null
      }
      if (clientRef.current) {
        clientRef.current.disconnect()
        clientRef.current = null
      }
    }
  }, [])

  const handleNickCancel = useCallback(() => {
    setShowJoinModal(false)
  }, [])

  const handleNickChange = useCallback(async (newNick: string) => {
    try {
      const me = await clientRef.current?.updateMe({ display_name: newNick })
      if (me) {
        setNick(me.display_name)
        setMyUserId(me.id)
        setNickMap(prev => {
          const next = new Map(prev)
          next.set(me.id, me.display_name)
          return next
        })
        pushToast(`Tu nick ahora es ${me.display_name}`, 'join')
      }
    } catch (e) {
      pushToast(`No se pudo cambiar el nick: ${(e as Error).message}`, 'error')
    }
    localStorage.setItem("chat.nick_prompted", "1")
    setShowNickModal(false)
  }, [pushToast])

  // ponytail: editing the topic/description of the current channel.
  // We PATCH the channel and rely on the next /channels refresh
  // (or the WS broadcast, if the server emits one) to update the
  // local copy. The topbar and context-menu both call into this.
  const handleSaveTopic = useCallback(async (description: string | null) => {
    if (currentChannel === null) return
    try {
      const client = clientRef.current
      if (!client) return
      const res = await mfApi<{ ok: boolean }>(
        `/api/chat/channels/${currentChannel}`,
        { method: "PATCH", body: JSON.stringify({ description }) },
      )
      if (!res?.ok) throw new Error("El servidor rechazó el cambio")
      // Apply optimistically; the next refreshChannels will confirm.
      setChannels(prev => {
        const ch = prev.get(currentChannel)
        if (!ch) return prev
        const next = new Map(prev)
        next.set(currentChannel, { ...ch, description })
        return next
      })
      pushToast(description ? "Descripción actualizada" : "Descripción eliminada", "join")
      // Nudge the server to push the new state to every other tab.
      client.refreshChannels().catch(() => {})
    } catch (e) {
      pushToast(`No se pudo guardar: ${(e as Error).message}`, "error")
    }
  }, [currentChannel, pushToast])

  const handleLoadMore = useCallback(async () => {
    if (currentChannel === null) return
    const ch = clientRef.current?.channels.get(currentChannel)
    if (!ch || ch.messages.length === 0) return
    setLoadingMore(true)
    try {
      const oldestId = ch.messages[0].id
      const limit = 20
      const loaded = await clientRef.current!.loadHistory(currentChannel, oldestId, limit)
      if (loaded.length < limit) {
        setHasMore(prev => ({ ...prev, [currentChannel]: false }))
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }, [currentChannel])

  const handleSend = useCallback((text: string) => {
    if (currentChannel === null) return
    const isAction = text.startsWith('/me ')
    const payload = isAction ? text.slice(4).trim() : text
    const opts: { is_action?: boolean; reply_to?: number } = { is_action: isAction }
    if (replyContext) opts.reply_to = replyContext.id
    clientRef.current?.sendMessage(currentChannel, payload, opts).catch((err) => {
      console.error("sendMessage failed", err)
    })
    setReplyContext(null)
  }, [currentChannel, replyContext])

  const handleReply = useCallback((msg: ChatMessage) => {
    // Replying and editing both own the composer, so entering one leaves the other.
    setEditContext(null)
    setReplyContext(msg)
    messageInputRef.current?.focus()
  }, [])

  const handleEdit = useCallback((msg: ChatMessage) => {
    setReplyContext(null)
    setEditContext(msg)
    messageInputRef.current?.focus()
  }, [])

  const handleEditSubmit = useCallback((text: string) => {
    const target = editContext
    if (!target) return
    // Unchanged text is a no-op: just leave edit mode.
    if (text === target.content) { setEditContext(null); return }
    // Stay in edit mode until the server confirms. Clearing editContext now
    // would fire MessageInput's draft-parking effect, which overwrites the
    // composer with the pre-edit draft - so if the PATCH then fails (expired
    // window, network) the user's typed edit would be gone with no way back.
    const client = clientRef.current
    if (!client) return
    client.editMessage(target.channel_id, target.id, text)
      .then(() => setEditContext(null))
      .catch((err) => {
        pushToast(`No se pudo editar: ${(err as Error).message}`, 'error')
      })
  }, [editContext, pushToast])

  const handleForward = useCallback((msg: ChatMessage) => {
    setForwardContext(msg)
  }, [])

  const handleForwardSubmit = useCallback(async (messageId: number, targetChannelId: number) => {
    try {
      await clientRef.current?.forwardMessage(messageId, targetChannelId)
      pushToast('Mensaje reenviado', 'join')
    } catch (err) {
      pushToast(`Error al reenviar: ${(err as Error).message}`, 'error')
      throw err
    }
  }, [pushToast])

  const handleBuzz = useCallback(async (targetUserId: number) => {
    if (currentChannel === null) return
    try {
      await clientRef.current?.buzz(currentChannel, targetUserId)
      const targetName = channelsRef.current.get(currentChannel)?.members?.find(m => m.id === targetUserId)?.display_name ?? 'usuario'
      pushToast(`🔔 Zumbaste a ${targetName}`, 'mention')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('not online') || msg.includes('404')) {
        pushToast('Ese usuario no está en línea', 'error')
      } else {
        pushToast(`Error: ${msg}`, 'error')
      }
    }
  }, [currentChannel, pushToast])

  const handleCopyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  const handleCopyImage = useCallback(async (msg: ChatMessage) => {
    const urls = extractImageUrls(msg.content)
    const first = urls.length > 0 ? urls[0] : extractImageUrl(msg.content)
    if (!first) return
    const src = first.startsWith('data:') ? first : `/api/chat/attachments/${first}`
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      // Clipboard API requires PNG or similar; for other types
      // we fall back to downloading.
      if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        pushToast('Imagen copiada al portapapeles', 'join')
      } else {
        const a = document.createElement('a')
        a.href = src
        a.download = first
        a.click()
        pushToast('Formato no compatible, descargando', 'join')
      }
    } catch {
      pushToast('No se pudo copiar la imagen', 'error')
    }
  }, [pushToast])

  const handleDownloadImage = useCallback((msg: ChatMessage) => {
    const urls = extractImageUrls(msg.content)
    const first = urls.length > 0 ? urls[0] : extractImageUrl(msg.content)
    if (!first) return
    const src = first.startsWith('data:') ? first : `/api/chat/attachments/${first}`
    const a = document.createElement('a')
    a.href = src
    a.download = first
    a.click()
  }, [])

  const handleDownloadAttachment = useCallback((msg: ChatMessage) => {
    const att = getAttachmentMarker(msg.content)
    if (!att) return
    const src = `/api/chat/attachments/${att.id}`
    const a = document.createElement('a')
    a.href = src
    a.download = att.id
    a.click()
  }, [])

  const handleCopyLink = useCallback((msg: ChatMessage) => {
    const att = getAttachmentMarker(msg.content)
    if (!att) return
    const url = `${window.location.origin}/api/chat/attachments/${att.id}`
    navigator.clipboard.writeText(url).then(
      () => pushToast('Enlace copiado', 'join'),
      () => pushToast('No se pudo copiar el enlace', 'error')
    )
  }, [pushToast])

  const handleSaveNotifPrefs = useCallback((prefs: any) => {
    setNotifPrefs(prefs)
    localStorage.setItem('chat.notif_prefs', JSON.stringify(prefs))
    setVolume(prefs.volume)
  }, [])

  const handleChannelSelect = useCallback((id: number) => {
    maybeFloatOnChannelSwitch(id, channels, (selectedId) => {
      clientRef.current?.setCurrentChannel(selectedId).then(() => {
        clientRef.current?.loadMembers(selectedId)
      }).catch(() => {})
      setCurrentChannel(selectedId)
      setShowChannelsDrawer(false)
      setHasMore(prev => prev[selectedId] !== false ? { ...prev, [selectedId]: true } : prev)
    })
  }, [maybeFloatOnChannelSwitch, channels])

  // ponytail: handleChannelJoin (and the onJoin prop on ChannelList)
  // are gone. Every channel you can see is one you can click into;
  // the create flow goes through handleJoinSubmit below, which still
  // works for "Crear canal" in the UI.

  const handleVoiceJoin = useCallback((channelId: number) => {
    // ponytail: create + resume the AudioContext INSIDE the click
    // handler. iOS Safari requires this for the autoplay policy; doing
    // it later (in VoiceRoomView's useEffect) puts the call outside
    // the user-gesture stack and the context stays suspended forever,
    // which makes MediaStreamAudioDestinationNode emit silent tracks.
    try {
      getOrCreateAudioContext()
      resumeAudioContext().catch(() => {})
    } catch { /* unsupported, getUserMedia will fail next */ }
    setActiveVoiceChannelId(channelId)
    setShowChannelsDrawer(false)
    // ponytail: load the text-chat history for this voice channel.
    // The /channels list call returns metadata only, never per-channel
    // messages, so without this the chat panel renders empty even if
    // the server has messages from a previous session.
    const ch = channels.get(channelId)
    if (ch && ch.messages.length === 0) {
      clientRef.current?.loadHistory(channelId).catch(() => {})
    }
  }, [channels])

  const handleVoiceLeave = useCallback((_channelId: number) => {
    setActiveVoiceChannelId(null)
  }, [])

  const handleChannelDelete = useCallback(async (channelId: number) => {
    const ch = channels.get(channelId)
    if (!ch) return
    try {
      await clientRef.current?.api('DELETE', `/api/chat/channels/${channelId}`)
      // Drop it from local state immediately; the WS broadcast will be a no-op.
      const next = new Map(channels)
      next.delete(channelId)
      setChannels(next)
      if (channelId === currentChannel) {
        const first = Array.from(next.values()).find(c => c.joined)
        if (first) handleChannelSelect(first.id)
        else setCurrentChannel(null)
      }
      if (activeVoiceChannelId === channelId) setActiveVoiceChannelId(null)
      pushToast(`Canal #${ch.name.replace(/^#/, '')} eliminado`, 'join')
    } catch (err) {
      pushToast(`Error al eliminar: ${(err as Error).message}`, 'error')
    }
  }, [channels, currentChannel, activeVoiceChannelId])

  // ponytail: handleChannelLeave and handleChannelJoinById are gone.
  // Every user is in every channel, so leaving and joining both
  // collapsed to no-ops on the server. Removing the handlers here
  // drops the dead "Unirse" / "Salir del canal" UI from the
  // channel list and context menu. The backend keeps the routes
  // as 200 no-ops for any stray old client.

  const handleJoinSubmit = useCallback((name: string) => {
    if (!name) return
    clientRef.current?.joinChannel(name).then((c) => {
      setCurrentChannel(c.id)
    }).catch((err) => {
      console.error("joinChannel failed", err)
    })
    setShowJoinModal(false)
  }, [])

  const typingNames = useMemo(() => {
    if (typing.size === 0) return []
    const out: string[] = []
    for (const id of typing.keys()) {
      const nick = nickMap.get(id) ?? channelsRef.current.get(currentChannel ?? -1)?.members?.find(m => m.id === id)?.display_name
      if (nick) out.push(nick)
    }
    return out
  }, [typing, nickMap, currentChannel])
  // Global online count across every channel the current user can see.
  // We sum unique user_ids whose `active` flag is true in each channel's
  // member list. Members we don't have yet (members not loaded) are
  // skipped; the periodic refresh fills them in.
  const onlineUserIds = useMemo(() => {
    const s = new Set<number>()
    for (const ch of channels.values()) {
      if (!ch.members) continue
      for (const m of ch.members) if (m.active) s.add(m.id)
    }
    return s
  }, [channels])

  // ponytail: publish the global online count to window.ChatEngine
  // so the shell's header can show the badge. We rebuild the same
  // global set on every channel/member change; the shell polls
  // this value every few seconds (see SiteHeader.tsx). The set
  // is a stable type so the shell can deep-compare cheaply if
  // it wants, but in practice the shell just reads `.size`.
  useEffect(() => {
    const engine = (window as { ChatEngine?: { onlineCount?: number } }).ChatEngine
    if (engine) {
      engine.onlineCount = onlineUserIds.size
    }
  }, [onlineUserIds])

  // ponytail: expose the "open this modal" actions to the shell so
  // the SiteHeader's user menu can launch the same nick/settings
  // dialogs the chat micro used to host. The shell falls back to
  // its own modal copies when the MF isn't mounted (e.g. on
  // /profile), so this is purely an optimisation for the
  // /irc route.
  useEffect(() => {
    const engine = (window as unknown as {
      ChatEngine?: {
        openNickModal?: () => void
        openNotificationSettings?: () => void
      }
    }).ChatEngine
    if (!engine) return
    engine.openNickModal = () => setShowNickModal(true)
    engine.openNotificationSettings = () => setShowSettingsModal(true)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-mf-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10   -transparent rounded-full animate-spin" />
          <div className="text-slate-400 text-sm">Conectando al chat...</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col overflow-hidden bg-accent/5 ${radioCurrent ? 'pb-14' : 'pb-0'} ${buzzShake ? 'shake-buzz' : ''}`}
      style={{ height: `calc(${vh}px * 100 - ${headerHeight}px)` }}
    >
      {showJoinModal && (
        <JoinChannelModal
          onSubmit={handleJoinSubmit}
          onCancel={handleNickCancel}
        />
      )}

      {showNickModal && (
        <NickPromptModal
          suggestedNick={googleName || nick}
          onSubmit={handleNickChange}
          onCancel={() => setShowNickModal(false)}
        />
      )}

      {showSettingsModal && (
        <NotificationSettingsModal
          prefs={notifPrefs}
          onSave={handleSaveNotifPrefs}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {managingChannelId !== null && channels.get(managingChannelId) && (
        <ManageMembersModal
          channel={channels.get(managingChannelId)!}
          currentUserId={myUserId ?? 0}
          myRole={channels.get(managingChannelId)!.myRole}
          onClose={() => setManagingChannelId(null)}
          onApiCall={async (method, path, body) => {
            return clientRef.current!.api(method, path, body)
          }}
          onMemberChanged={() => {
            if (currentChannel !== null) {
              clientRef.current?.loadMembers(currentChannel)
            }
          }}
        />
      )}

      {forwardContext && (
        <ForwardModal
          message={forwardContext}
          channels={channels}
          currentChannelId={currentChannel}
          onClose={() => setForwardContext(null)}
          onForward={handleForwardSubmit}
        />
      )}

      <Topbar
        currentChan={currentChan ?? undefined}
        showUsersDrawer={showUsersDrawer}
        onToggleUsers={() => setShowUsersDrawer((v) => !v)}
        onOpenChannels={() => setShowChannelsDrawer(true)}
        onEditTopic={() => setShowEditTopic(true)}
        canEditTopic={
          (globalRole === "super_admin" || globalRole === "admin") ||
          (currentChan?.myRole === "admin" || currentChan?.myRole === "mod")
        }
      />

      {showEditTopic && currentChannel !== null && currentChan && (
        <EditChannelDescriptionModal
          open={showEditTopic}
          channelId={currentChannel}
          channelName={currentChan.name}
          currentDescription={currentChan.description ?? null}
          onClose={() => setShowEditTopic(false)}
          onSaved={handleSaveTopic}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* ponytail: chat doodle wallpaper, painted as a sibling of
         * the asides + main so it spans the full width and lives
         * in the same stacking context. The sidebar backdrop-blur
         * can then resolve the motifs behind it (which it could
         * not when the layer sat at body level via position:fixed
         * and was hidden by overflow-hidden stacking contexts). */}
        <div
          className="bg-doodles-static bg-chat-doodles"
          aria-hidden="true"
        />
        <aside className="w-48 flex-shrink-0 hidden sm:block bg-surface-tint-60 backdrop-blur-md border-r border-white/5 select-none relative z-[1]">
          <ChannelList
            channels={channels}
            categories={categories}
            currentChannel={currentChan?.name || "#lobby"}
            activeVoiceChannelId={activeVoiceChannelId}
            onSelect={(name) => {
              const ch = Array.from(channels.values()).find(c => c.name === name)
              if (ch) handleChannelSelect(ch.id)
            }}
            onVoiceJoin={handleVoiceJoin}
            onVoiceLeave={handleVoiceLeave}
            onCreateRequest={() => setShowJoinModal(true)}
            onCopyName={handleCopyText}
            onManageMembers={setManagingChannelId}
            onEditTopic={(id) => {
              const ch = channels.get(id)
              if (!ch) return
              setCurrentChannel(id)
              setShowEditTopic(true)
            }}
            onDelete={handleChannelDelete}
          />
        </aside>

        <main
          className="flex-1 flex flex-col min-w-0 relative z-[1] bg-mf-surface overflow-hidden"
        >
          {activeVoiceChannelId !== null ? (() => {
            const vch = channels.get(activeVoiceChannelId)
            if (!vch) return null
            return (
              <VoiceRoomView
                channel={vch}
                myUserId={myUserId}
                myRole={vch.myRole}
                nick={nick}
                nickMap={nickMap}
                sendViaWs={(msg) => clientRef.current?.sendRaw(msg)}
                onVoiceMessage={onVoiceMessage}
                onSendMessage={(chId, content) => clientRef.current?.sendMessage(chId, content).catch(() => {})}
                onLeave={() => handleVoiceLeave(activeVoiceChannelId!)}
              />
            )
          })() : (
            <>
              <MessageList
                key={currentChannel ?? "none"}
                messages={currentChan?.messages || []}
                currentNick={nick}
                channelName={currentChan?.name || "#lobby"}
                channelMembers={currentChan?.members || []}
                nickByUserId={nickMap}
                myUserId={myUserId}
                myRole={currentChan?.myRole ?? null}
                onToggleReaction={(messageId, emoji) => {
                  clientRef.current?.toggleReaction(messageId, emoji).catch(() => {})
                }}
                onLoadMore={handleLoadMore}
                loadingMore={loadingMore}
                hasMore={currentChannel !== null ? hasMore[currentChannel] !== false : false}
                onReply={handleReply}
                onForward={handleForward}
                onBuzz={handleBuzz}
                onCopyText={handleCopyText}
                onCopyImage={handleCopyImage}
                onDownloadImage={handleDownloadImage}
                onDownloadAttachment={handleDownloadAttachment}
                onCopyLink={handleCopyLink}
                onEdit={handleEdit}
                editWindowSeconds={clientRef.current?.editWindow}
                onHide={async (messageId) => {
                  try {
                    // Optimistic: mark hidden locally before the
                    // round-trip. The server's WS broadcast
                    // (which includes the sender) will confirm.
                    const c = clientRef.current
                    if (c) {
                      for (const ch of c.channels.values()) {
                        const idx = ch.messages.findIndex(m => m.id === messageId)
                        if (idx >= 0) {
                          const newMessages = ch.messages.slice()
                          newMessages[idx] = { ...ch.messages[idx], hidden: true }
                          c.channels.set(ch.id, { ...ch, messages: newMessages })
                          break
                        }
                      }
                    }
                    await c?.api('POST', `/api/chat/messages/${messageId}/hide`)
                    pushToast('Mensaje oculto', 'join')
                  } catch (err) {
                    pushToast(`Error al ocultar: ${(err as Error).message}`, 'error')
                  }
                }}
                onDelete={async (messageId) => {
                  try {
                    // Optimistic: hide the message locally before
                    // the round-trip. The server's WS broadcast
                    // (which includes the sender) will confirm.
                    const c = clientRef.current
                    if (c) {
                      for (const ch of c.channels.values()) {
                        const idx = ch.messages.findIndex(m => m.id === messageId)
                        if (idx >= 0) {
                          const newMessages = ch.messages.slice()
                          newMessages[idx] = { ...ch.messages[idx], hidden: true, content: '[eliminado]' }
                          c.channels.set(ch.id, { ...ch, messages: newMessages })
                          break
                        }
                      }
                    }
                    await c?.api('DELETE', `/api/chat/messages/${messageId}`)
                    pushToast('Mensaje eliminado', 'join')
                  } catch (err) {
                    pushToast(`Error al eliminar: ${(err as Error).message}`, 'error')
                  }
                }}
                onVideoFloat={handleVideoFloat}
                onVideoPlay={handleVideoPlay}
                onVideoRef={handleVideoRef}
                floatingVideo={floatingVideo}
              />
              <TypingIndicator names={typingNames} />
              <MessageInput
                ref={messageInputRef}
                onSend={handleSend}
                onTyping={currentChannel !== null ? () => clientRef.current?.sendTyping(currentChannel, true) : undefined}
                disabled={!connected || currentChannel === null}
                placeholder={connected ? `Mensaje en ${currentChan?.name || ''}` : "Conectando..."}
                channelMembers={currentChan?.members || []}
                channelId={currentChannel}
                replyContext={replyContext}
                onClearReply={() => setReplyContext(null)}
                editContext={editContext}
                onClearEdit={() => setEditContext(null)}
                onSubmitEdit={handleEditSubmit}
                onError={(msg) => pushToast(msg, 'error')}
                onUploadFile={async (chId, file) => {
                  return clientRef.current!.uploadAttachment(chId, file)
                }}
                onSendAttachment={async (chId, kind, attachmentId) => {
                  const marker = `__late_${kind}__:${attachmentId}`
                  clientRef.current?.sendMessage(chId, marker).catch((err) => {
                    console.error('sendAttachment failed', err)
                  })
                }}
                onSearchUsers={async (q) => {
                  try {
                    return await clientRef.current!.api('GET', `/api/chat/users?q=${encodeURIComponent(q)}`)
                  } catch {
                    return []
                  }
                }}
                onInviteUser={async (channelId, email) => {
                  try {
                    return await clientRef.current!.api('POST', `/api/chat/channels/${channelId}/invite`, { email })
                  } catch {
                    return { ok: false }
                  }
                }}
                onInviteConfirm={(user) => {
                  if (currentChannel !== null) {
                    clientRef.current?.loadMembers(currentChannel)
                  }
                  pushToast(`${user.display_name} se unió al canal`, 'join')
                }}
              />
            </>
          )}
          {toasts.length > 0 && (
            <ToastStack toasts={toasts} onDismiss={dismissToast} />
          )}
        </main>

        {showUsersDrawer && currentChannel !== null && (
          <aside className="hidden sm:flex w-64 flex-shrink-0 flex-col bg-surface-tint-80 backdrop-blur-md border-l border-white/5 select-none relative z-[1]">
            {showUsersDrawer && (
              <>
                <div className="flex items-center justify-between px-3 py-2.5  ">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Usuarios en línea
                  </h3>
          <span className="text-[10px] text-slate-500 tabular-nums">
            {currentChan?.members?.filter(m => m.active).length ?? 0} en línea · {currentChan?.members?.length ?? 0} en el canal
          </span>
                  <button
                    onClick={() => setShowUsersDrawer(false)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1 -mr-1"
                    aria-label="Cerrar"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <UserList
                  users={currentChan?.members || []}
                  onBuzz={handleBuzz}
                  onCopyName={handleCopyText}
                />
              </>
            )}
          </aside>
        )}
      </div>

      <Drawer
        open={showChannelsDrawer}
        onClose={() => setShowChannelsDrawer(false)}
        side="left"
      >
          <ChannelList
            channels={channels}
            categories={categories}
            currentChannel={currentChan?.name || "#lobby"}
            activeVoiceChannelId={activeVoiceChannelId}
            onSelect={(name) => {
              const ch = Array.from(channels.values()).find(c => c.name === name)
              if (ch) handleChannelSelect(ch.id)
            }}
            onVoiceJoin={handleVoiceJoin}
            onVoiceLeave={handleVoiceLeave}
            onCreateRequest={() => { setShowChannelsDrawer(false); setShowJoinModal(true) }}
            onClose={() => setShowChannelsDrawer(false)}
            onCopyName={handleCopyText}
            onManageMembers={setManagingChannelId}
            onEditTopic={(id) => {
              const ch = channels.get(id)
              if (!ch) return
              setCurrentChannel(id)
              setShowEditTopic(true);
            }}
            onDelete={handleChannelDelete}
          />
      </Drawer>
      <Drawer
        open={showUsersDrawer}
        onClose={() => setShowUsersDrawer(false)}
        side="right"
      >
        <div className="flex items-center justify-between px-3 py-2.5  ">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Usuarios en línea
          </h3>
          <span className="text-[10px] text-slate-500 tabular-nums">
            {currentChan?.members?.filter(m => m.active).length ?? 0} en línea · {currentChan?.members?.length ?? 0} en el canal
          </span>
        </div>
        <UserList
          users={currentChan?.members || []}
          onBuzz={handleBuzz}
          onCopyName={handleCopyText}
        />
      </Drawer>
      <FloatingVideoContainer
        ref={floatingContainerRef}
        visible={floatingVideo}
        onClose={closeFloatingVideo}
      />
    </div>
  )
}

function DebugCopyButton({ label }: { label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button
      type="button"
      onClick={async () => {
        const text = JSON.stringify(takeSnapshot(), null, 2)
        try {
          await navigator.clipboard.writeText(text)
          setState('copied')
        } catch {
          setState('failed')
          // Fallback: open a prompt with the JSON so the user can
          // manually copy from there if the Clipboard API is blocked.
          window.prompt('Copiá este JSON (Ctrl/Cmd+A, Ctrl/Cmd+C):', text)
        }
        setTimeout(() => setState('idle'), 2500)
      }}
      className="px-3 py-1.5 rounded-md  hover: bg-surface-2 hover:bg-surface-3 text-slate-300 text-xs font-mono transition-colors"
    >
      {state === 'copied' ? '¡Copiado!' : state === 'failed' ? 'No se pudo copiar' : label}
    </button>
  )
}

function ToastStack({ toasts, onDismiss }: { toasts: { id: string; text: string; type: string; sticky: boolean }[]; onDismiss: (id: string) => void }) {
  return (
    <div className="absolute top-2 right-3 z-50 flex flex-col items-end gap-2 max-w-md pointer-events-auto">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={t.sticky ? undefined : () => onDismiss(t.id)}
          role={t.sticky ? 'alert' : 'status'}
          className={`flex items-start gap-3 px-5 py-3 rounded-xl text-sm font-medium shadow-floating backdrop-blur-sm transition-all animate-menu-toast ${
            t.sticky
              ? 'cursor-default'
              : 'cursor-pointer hover:scale-[1.02] hover:-translate-x-0.5'
          } ${
            t.type === 'mention'
              ? 'bg-accent/15  text-accent-soft hover:'
              : t.type === 'join'
              ? 'bg-emerald-900/95  text-emerald-200 hover:'
              : 'bg-rose-900/95  text-rose-200 hover:'
          }`}
        >
          <span className="flex-1 break-words leading-snug">{t.text}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(t.id) }}
            className="text-slate-500 hover:text-slate-200 flex-shrink-0 -mr-1 cursor-pointer"
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
