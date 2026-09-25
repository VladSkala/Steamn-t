import { t, useLocale } from "../i18n/index.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
const errorText = error => error.response?.data?.detail || t("Could not complete the request. Please try again.");
const CHAT_REFRESH_INTERVAL_MS = 3000;
function Attachment({
  message
}) {
  useLocale();
  const [state, setState] = useState({
    url: "",
    error: false
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!message.has_attachment) return undefined;
    let active = true;
    let objectUrl = "";
    api.get(`/chat/messages/${message.id}/attachment/`, {
      responseType: "blob"
    }).then(({
      data
    }) => {
      objectUrl = URL.createObjectURL(data);
      if (active) setState({
        url: objectUrl,
        error: false
      });else URL.revokeObjectURL(objectUrl);
    }).catch(() => {
      if (active) setState({
        url: "",
        error: true
      });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.has_attachment, attempt]);
  if (!message.has_attachment) return null;
  if (state.error) return <button type="button" onClick={() => setAttempt(n => n + 1)}>{t("Retry attachment")}</button>;
  if (!state.url) return <span role="status">{t("Loading attachment…")}</span>;
  if (message.kind === "image") return <a href={state.url} target="_blank" rel="noreferrer"><img className="chat-media" src={state.url} alt={message.attachment_name || t("Chat image")} /></a>;
  if (message.kind === "voice") return <audio controls preload="metadata" src={state.url} aria-label={t("Voice message")} />;
  return <a href={state.url} download={message.attachment_name}>↓ {message.attachment_name}</a>;
}
function Avatar({
  person,
  large = false
}) {
  useLocale();
  return <span className={`chat-avatar${large ? " large" : ""}`}>{person.avatar ? <img src={person.avatar} alt="" /> : person.username.charAt(0).toUpperCase()}</span>;
}
function Conversation({
  id,
  user,
  refreshConversations
}) {
  useLocale();
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [more, setMore] = useState(false);
  const [body, setBody] = useState("");
  const [upload, setUpload] = useState(null);
  const [kind, setKind] = useState("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mediaTab, setMediaTab] = useState("profile");
  const [media, setMedia] = useState([]);
  const [mediaMore, setMediaMore] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const detailsButtonRef = useRef(null);
  const detailsPanelRef = useRef(null);
  const shouldScroll = useRef(true);
  const latestIncoming = useRef(null);
  const prefix = `/chat/conversations/${id}/`;
  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    window.requestAnimationFrame(() => detailsButtonRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!detailsOpen) return undefined;
    const narrow = window.matchMedia("(max-width: 1180px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (narrow) {
      document.body.style.overflow = "hidden";
      window.requestAnimationFrame(() => detailsPanelRef.current?.querySelector(".chat-details-close")?.focus());
    }
    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (narrow) document.body.style.overflow = previousOverflow;
    };
  }, [closeDetails, detailsOpen]);
  const load = useCallback(async () => {
    const [detail, history] = await Promise.all([api.get(prefix), api.get(`${prefix}messages/`)]);
    const incoming = history.data.results.filter(item => item.sender_id !== user.id).map(item => item.id);
    const latest = Math.max(0, ...incoming);
    if (latestIncoming.current !== null && latest > latestIncoming.current && user.notification_preferences?.message_sound !== false && !detail.data.muted) {
      try {
        const audio = new (window.AudioContext || window.webkitAudioContext)();
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        tone.connect(gain);
        gain.connect(audio.destination);
        tone.frequency.value = 660;
        gain.gain.setValueAtTime(0.05, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
        tone.start();
        tone.stop(audio.currentTime + 0.18);
        tone.onended = () => audio.close();
      } catch {/* Browsers may require a prior user gesture for audio. */}
    }
    latestIncoming.current = latest;
    setActive(detail.data);
    setMessages(current => {
      const merged = new Map(current.map(item => [item.id, item]));
      for (const item of history.data.results) merged.set(item.id, item);
      return [...merged.values()].sort((a, b) => a.id - b.id);
    });
    setMore(current => current || Boolean(history.data.next));
    const hasUnreadIncoming = history.data.results.some(item => item.sender_id !== user.id && !item.read_at);
    if (document.visibilityState === "visible" && hasUnreadIncoming) await api.post(`${prefix}read/`);
  }, [prefix, user.id, user.notification_preferences?.message_sound]);
  useEffect(() => {
    let alive = true;
    let timer;
    const refresh = async () => {
      try {
        await load();
      } catch (err) {
        if (alive) setError(errorText(err));
      } finally {
        if (alive) timer = window.setTimeout(refresh, CHAT_REFRESH_INTERVAL_MS);
      }
    };
    refresh();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [load]);
  useEffect(() => {
    if (shouldScroll.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (mediaTab === "profile") return undefined;
    const controller = new AbortController();
    api.get(`${prefix}messages/`, {
      params: {
        kind: mediaTab
      },
      signal: controller.signal
    }).then(({
      data
    }) => {
      setMedia(data.results);
      setMediaMore(Boolean(data.next));
    }).catch(err => {
      if (!controller.signal.aborted) setError(errorText(err));
    });
    return () => controller.abort();
  }, [mediaTab, prefix]);
  const older = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const {
        data
      } = await api.get(`${prefix}messages/`, {
        params: {
          before: messages[0]?.id
        }
      });
      shouldScroll.current = false;
      setMessages(current => [...data.results.reverse(), ...current]);
      setMore(Boolean(data.next));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const moreMedia = async () => {
    setBusy(true);
    try {
      const {
        data
      } = await api.get(`${prefix}messages/`, {
        params: {
          kind: mediaTab,
          before: media.at(-1)?.id
        }
      });
      setMedia(current => [...current, ...data.results]);
      setMediaMore(Boolean(data.next));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const send = async event => {
    event.preventDefault();
    if (busy || recording || !body.trim() && !upload || !active?.can_message) return;
    setBusy(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("body", body.trim());
      payload.append("kind", upload ? kind : "text");
      if (upload) payload.append("attachment", upload);
      const {
        data
      } = await api.post(`${prefix}messages/`, payload);
      shouldScroll.current = true;
      setMessages(current => [...current, data]);
      setBody("");
      setUpload(null);
      await refreshConversations();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const chooseUpload = file => {
    if (file?.size > 10 * 1024 * 1024) {
      setError("Choose a file smaller than 10 MB.");
      return;
    }
    setUpload(file || null);
    setKind(file?.type.startsWith("image/") ? "image" : file?.type.startsWith("audio/") ? "voice" : "file");
  };
  const record = async () => {
    if (recording) {
      recorderRef.current.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error(t("Voice recording is not supported in this browser. Attach an audio file instead."));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? {
        mimeType
      } : undefined);
      recorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        const type = recorder.mimeType;
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        chooseUpload(new File(chunks, `voice-${Date.now()}.${extension}`, {
          type
        }));
      };
      recorder.start();
      setRecording(true);
      setError("");
    } catch (err) {
      setError(err.message || t("Microphone access is unavailable."));
    }
  };
  const action = async type => {
    if (busy) return;
    if (["clear", "block", "remove"].includes(type) && !window.confirm(type === "clear" ? t("Clear this conversation for your account? The other participant keeps their history.") : type === "remove" ? t("Remove this person from friends?") : active.blocked ? t("Unblock this user?") : t("Block this user? This also removes friendship and follows."))) return;
    setBusy(true);
    setError("");
    try {
      if (type === "mute") {
        const {
          data
        } = await api.patch(prefix, {
          muted: !active.muted
        });
        setActive(data);
      }
      if (type === "clear") {
        await api.delete(prefix);
        setMessages([]);
        setMedia([]);
        setMore(false);
        await refreshConversations();
      }
      if (type === "block") {
        await api[active.blocked ? "delete" : "post"](`/users/${active.other_user.id}/block/`);
        await load();
      }
      if (type === "remove") {
        await api.delete(`/friends/${active.other_user.id}/`);
        setNotice("Friend removed.");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return <><section className="chat-conversation" aria-label={t("Conversation")}>
    {error && <div role="alert" className="chat-error">{t(error)} <button onClick={() => {
          setError("");
          load().catch(err => setError(errorText(err)));
        }}>{t("Retry")}</button></div>}
    {notice && <div role="status" className="purchase-toast">{t(notice)}</div>}
    {!active ? <div className="chat-empty" role="status">{t("Loading conversation…")}</div> : <>
      <header className="chat-conversation-header"><Avatar person={active.other_user} /><div><Link to={`/users/${active.other_user.id}`}><strong>{active.other_user.username}</strong></Link><small>{active.other_user.is_online ? t("Online") : t("Offline")}{active.muted ? t(" · Muted") : ""}</small></div><button ref={detailsButtonRef} type="button" aria-expanded={detailsOpen} aria-controls="chat-details" onClick={() => detailsOpen ? closeDetails() : setDetailsOpen(true)}>{t("Details")}</button></header>
      <div className="chat-message-list" ref={listRef} onScroll={() => {
          const element = listRef.current;
          shouldScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
        }}>
        {more && <button type="button" disabled={busy} onClick={older}>{t("Load earlier messages")}</button>}
        {messages.length === 0 && <p className="chat-empty-small">{t("Start the conversation. Say hello or share something you love.")}</p>}
        {messages.map(message => <div key={message.id} className={`chat-bubble ${message.sender_id === user?.id ? "outgoing" : "incoming"}`}><p className="sr-only">{message.sender_id === user?.id ? t("You") : active.other_user.username}</p>{message.body && <p>{message.body}</p>}<Attachment message={message} /><time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString(document.documentElement.dataset.locale || "en")}>{new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })}{message.sender_id === user?.id ? message.read_at ? t(" · Read") : t(" · Sent") : ""}</time></div>)}<div ref={bottomRef} />
      </div>
      {!active.can_message ? <p className="chat-empty-small">{active.message_unavailable_reason === "friends_only" ? <>{t("Only friends can message this user. Blocking removes friendship; send a new friend request from the public profile to resume the conversation.")} <Link to={`/users/${active.other_user.id}`}>{t("Public profile →")}</Link></> : active.message_unavailable_reason === "privacy" ? t("This user does not accept messages.") : t("Messages are unavailable because of privacy settings or a block.")}</p> : <form className="chat-composer" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-message">{t("Message")}</label><input id="chat-message" value={body} onChange={event => setBody(event.target.value)} placeholder={t("Write a message…")} maxLength={4000} />
        <label className="chat-attach">{t("Attach")}<input type="file" accept=".jpg,.jpeg,.png,.webp,.mp3,.m4a,.ogg,.webm,.wav,.pdf,.txt,.zip,.docx,.xlsx" onChange={event => {
              chooseUpload(event.target.files[0]);
              event.target.value = "";
            }} /></label>
        <button type="button" className="chat-record" aria-pressed={recording} onClick={record}>{recording ? t("Stop recording") : t("Voice")}</button>
        <button type="submit" disabled={busy || recording || !body.trim() && !upload}>{busy ? t("Sending…") : t("Send")}</button>
        {recording && <span role="status">{t("Recording… Press Stop to review your attachment.")}</span>}
        {upload && <span className="chat-upload-name">{upload.name}<button type="button" onClick={() => setUpload(null)} aria-label={t("Remove attachment")}>×</button></span>}
      </form>}
    </>}
  </section>{active && detailsOpen && <button type="button" className="chat-details-backdrop" onClick={closeDetails} aria-label={t("Close details")} />}{active && <aside ref={detailsPanelRef} className={`chat-profile-panel${detailsOpen ? " is-open" : ""}`} id="chat-details" aria-label={t("Conversation details")} aria-hidden={!detailsOpen}><div className="chat-details-header"><button className="chat-details-close" type="button" onClick={closeDetails} aria-label={t("Close details")} title={t("Close details")}><span aria-hidden="true">←</span></button><strong>{t("Details")}</strong></div><nav aria-label={t("Conversation media")}>{[["profile", "Profile"], ["image", "Photos"], ["file", "Files"], ["voice", "Voice"]].map(([tab, label]) => <button key={tab} type="button" className={mediaTab === tab ? "active" : ""} onClick={() => setMediaTab(tab)}>{t(label)}</button>)}</nav>
    {mediaTab === "profile" ? <div className="chat-person"><Avatar person={active.other_user} large /><h2>{active.other_user.username}</h2><Link to={`/users/${active.other_user.id}`}>{t("Public profile →")}</Link><div className="chat-person-actions"><button disabled={busy} onClick={() => action("mute")}>{active.muted ? t("Unmute notifications") : t("Mute notifications")}</button><button disabled={busy} onClick={() => action("clear")}>{t("Clear my history")}</button><button disabled={busy} onClick={() => action("remove")}>{t("Remove friend")}</button><button disabled={busy} onClick={() => action("block")}>{active.blocked ? t("Unblock user") : t("Block user")}</button></div></div> : <div className="chat-media-history">{media.length ? media.map(message => <div key={message.id}><Attachment message={message} /><small>{new Date(message.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</small></div>) : <p>{t("No shared attachments in this category.")}</p>}{mediaMore && <button disabled={busy} onClick={moreMedia}>{t("Load more")}</button>}</div>}
  </aside>}</>;
}
export default function ChatPage() {
  useLocale();
  const {
    user
  } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get("conversation")) || 0;
  const requestedUser = Number(params.get("user_id")) || 0;
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const refreshPromiseRef = useRef(null);
  const refreshConversations = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const request = (async () => {
      const items = [];
      let next = "/chat/conversations/";
      while (next) {
        const {
          data
        } = await api.get(next);
        items.push(...(data.items || []));
        next = data.next || null;
      }
      setConversations(items);
      setLoaded(true);
    })();
    refreshPromiseRef.current = request;
    try {
      return await request;
    } finally {
      if (refreshPromiseRef.current === request) refreshPromiseRef.current = null;
    }
  }, []);
  useEffect(() => {
    const load = () => refreshConversations().catch(err => setError(errorText(err)));
    load();
    const timer = window.setInterval(load, CHAT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshConversations]);
  useEffect(() => {
    if (!requestedUser) return undefined;
    let cancelled = false;
    api.post("/chat/conversations/", {
      user_id: requestedUser
    }).then(({
      data
    }) => {
      if (!cancelled) {
        setParams({
          conversation: String(data.id)
        }, {
          replace: true
        });
        refreshConversations();
      }
    }).catch(err => {
      if (!cancelled) setError(errorText(err));
    });
    return () => {
      cancelled = true;
    };
  }, [requestedUser, refreshConversations, setParams]);
  return <div className={`chat-shell${selectedId ? " has-conversation" : ""}`}><aside className="chat-dialogs" aria-label={t("Conversations")}><h1>{t("Messages")}</h1><p>{t("Your people. Your conversations.")}</p><label className="sr-only" htmlFor="dialog-search">{t("Search conversations")}</label><input id="dialog-search" type="search" placeholder={t("Search conversations")} value={search} onChange={event => setSearch(event.target.value)} />
    {error && <p role="alert">{t(error)}</p>}{!loaded && <p role="status">{t("Loading conversations…")}</p>}{loaded && conversations.length === 0 && <div className="chat-empty-small">{t("No conversations yet.")}<Link to="/friends">{t("Find your friends →")}</Link></div>}
    {conversations.filter(conversation => conversation.other_user.username.toLowerCase().includes(search.toLowerCase())).map(conversation => <button type="button" key={conversation.id} className={`chat-dialog ${conversation.id === selectedId ? "active" : ""}`} onClick={() => setParams({
        conversation: String(conversation.id)
      })}><Avatar person={conversation.other_user} /><span><strong>{conversation.other_user.username}</strong><small>{conversation.last_message?.body || conversation.last_message?.attachment_name || t("New conversation")}</small></span>{conversation.unread_count > 0 && <b aria-label={t("{count} unread", { count: conversation.unread_count })}>{conversation.unread_count}</b>}</button>)}
  </aside>{selectedId ? <Conversation key={selectedId} id={selectedId} user={user} refreshConversations={refreshConversations} /> : <section className="chat-conversation"><div className="chat-empty"><div><h2>{t("A good game is better together.")}</h2><p>{t("Select a conversation, or find someone to play with.")}</p><Link to="/friends">{t("Find friends →")}</Link></div></div></section>}</div>;
}
