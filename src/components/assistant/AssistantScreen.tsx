// ============================================================
// RAG Clinical Assistant Screen
// Dual-mode: patient RAG chat OR doctor general/context chat
// ============================================================

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import type { DoctorPatientContext } from "../dashboard/DoctorDashboard";
import type { RAGResponse, ChatMessage, SourceCitation } from "../../lib/types/rag";
import styles from "./AssistantScreen.module.css";
import { ChevronLeft, Paperclip, ArrowUp, Cross } from "lucide-react";
import { GeminiIcon } from "../common/GeminiIcon";

// ---------------------------------------------------------------------------
// Lightweight markdown → React renderer (no external dependency)
// Handles: ### headings, **bold**, - lists, [Source N] inline citations
// ---------------------------------------------------------------------------
function renderContent(
    content: string,
    citations: SourceCitation[] | undefined,
    onNav: (screen: string) => void
): React.ReactNode {
    let _k = 0;
    const k = () => _k++;

    function inline(text: string): React.ReactNode[] {
        const parts: React.ReactNode[] = [];
        const re = /\*\*([^*]+)\*\*|\[Source (\d+)\]/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            if (m.index > last) parts.push(text.slice(last, m.index));
            if (m[1] !== undefined) {
                parts.push(<strong key={k()}>{m[1]}</strong>);
            } else {
                const num = parseInt(m[2], 10);
                const cite = citations?.[num - 1];
                parts.push(
                    <button
                        key={k()}
                        className={styles.inlineCitation}
                        onClick={() => cite && onNav(`entry/${cite.entryId}`)}
                        title={cite?.entryTitle ?? `Source ${num}`}
                    >
                        [{num}]
                    </button>
                );
            }
            last = re.lastIndex;
        }
        if (last < text.length) parts.push(text.slice(last));
        return parts;
    }

    const nodes: React.ReactNode[] = [];
    let listBuf: React.ReactNode[] = [];

    const flushList = () => {
        if (listBuf.length) {
            nodes.push(<ul key={k()} className={styles.mdList}>{listBuf}</ul>);
            listBuf = [];
        }
    };

    for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (!line) { flushList(); continue; }

        const h3 = line.match(/^###\s+(.*)/);
        const h2 = line.match(/^##\s+(.*)/);
        const h1 = line.match(/^#\s+(.*)/);
        const li = line.match(/^[-*]\s+(.*)/);

        if (h3) { flushList(); nodes.push(<h3 key={k()} className={styles.mdH3}>{inline(h3[1])}</h3>); }
        else if (h2) { flushList(); nodes.push(<h2 key={k()} className={styles.mdH2}>{inline(h2[1])}</h2>); }
        else if (h1) { flushList(); nodes.push(<h1 key={k()} className={styles.mdH1}>{inline(h1[1])}</h1>); }
        else if (li) { listBuf.push(<li key={k()}>{inline(li[1])}</li>); }
        else { flushList(); nodes.push(<p key={k()} className={styles.mdPara}>{inline(line)}</p>); }
    }
    flushList();
    return <>{nodes}</>;
}

interface AssistantScreenProps {
    onNavigate: (screen: string) => void;
    /** When a doctor has a verified patient session, provide that patient's context. */
    doctorPatientContext?: DoctorPatientContext;
}

export default function AssistantScreen({ onNavigate, doctorPatientContext }: AssistantScreenProps) {
    const { patient } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Determine mode
    const isDoctor = !patient; // doctors don't have a patient object from useAuth
    const hasPatientContext = isDoctor && !!doctorPatientContext;
    const isGeneralMode = isDoctor && !doctorPatientContext;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            messageId: `msg-${Date.now()}`,
            role: "user",
            content: input,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            let answer = "";
            let newConversationId = conversationId;
            let citations: SourceCitation[] | undefined;

            if (isGeneralMode) {
                // Doctor, no patient — call general LLM endpoint
                const res = await fetch("/api/assistant/general", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: input, conversationId }),
                });
                const data = await res.json();
                answer = data.answer || "Sorry, I couldn't process that request.";
                newConversationId = data.conversationId;
            } else {
                // Patient mode OR doctor with patient context — use RAG endpoint
                const patientId = hasPatientContext
                    ? doctorPatientContext!.cardId
                    : patient!.patientId;
                const queryBy = hasPatientContext ? "DOCTOR" : "PATIENT";
                const queryByUserId = hasPatientContext ? `doctor-${patientId}` : patientId;

                const res = await fetch("/api/assistant/rag", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: input,
                        patientId,
                        queryBy,
                        queryByUserId,
                        conversationId,
                    }),
                });
                const data: RAGResponse = await res.json();
                answer = data.answer || "Sorry, I couldn't process that request.";
                citations = data.citations;
                newConversationId = data.conversationId;
            }

            if (!conversationId) setConversationId(newConversationId);

            const assistantMsg: ChatMessage = {
                messageId: `msg-${Date.now()}-resp`,
                role: "assistant",
                content: answer,
                citations,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch {
            const errorMsg: ChatMessage = {
                messageId: `msg-${Date.now()}-err`,
                role: "assistant",
                content: "I apologize, but I encountered an error processing your query. Please try again.",
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const suggestedQuestions = hasPatientContext
        ? [
            `Summarize ${doctorPatientContext!.name.split(" ")[0]}'s medical history`,
            "What medications is this patient on?",
            "Any red flags or abnormal values?",
            "When was the last check-up?",
        ]
        : isGeneralMode
        ? [
            "What are the first-line treatments for Type 2 Diabetes?",
            "ICMR guidelines for hypertension management?",
            "Common drug interactions with Metformin",
            "Differential diagnosis for chest pain in a 45-year-old",
        ]
        : [
            "What medications am I currently on?",
            "Summarize my recent lab results",
            "Are there any drug interactions?",
            "When was my last checkup?",
        ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button className={styles.backButton} onClick={() => onNavigate(isDoctor ? "doctor-dashboard" : "dashboard")}><ChevronLeft size={20} /></button>
                <div className={styles.headerInfo}>
                    <h1 className={styles.title}>AI Health Assistant</h1>
                    <span className={styles.subtitle}>
                        {hasPatientContext
                            ? `Patient: ${doctorPatientContext!.name}`
                            : isGeneralMode
                            ? "General medical knowledge"
                            : "Powered by Amazon Bedrock"}
                    </span>
                </div>
            </header>

            {/* Patient context banner for doctor mode */}
            {hasPatientContext && (
                <div className={styles.contextBanner}>
                    <span className={styles.contextBannerDot} />
                    <span>
                        Viewing context for <strong>{doctorPatientContext!.name}</strong>
                        {doctorPatientContext!.age > 0 ? `, ${doctorPatientContext!.age} yrs` : ""}
                        {doctorPatientContext!.gender ? ` · ${doctorPatientContext!.gender}` : ""}
                        {" · "}
                        <span className={styles.contextCardId}>{doctorPatientContext!.cardId}</span>
                    </span>
                </div>
            )}

            {isGeneralMode && (
                <div className={styles.generalModeBanner}>
                    <span>General mode — Verify a patient on the dashboard to enable context-aware record queries.</span>
                </div>
            )}

            <div className={styles.chatArea}>
                {messages.length === 0 ? (
                    <div className={styles.welcome}>
                        <span className={styles.welcomeIcon}><GeminiIcon size={48} /></span>
                        {hasPatientContext ? (
                            <>
                                <h2>Ready to assist with {doctorPatientContext!.name.split(" ")[0]}&apos;s records.</h2>
                                <p>Ask me anything about this patient&apos;s medical history. I&apos;ll cite sources from their health records.</p>
                            </>
                        ) : isGeneralMode ? (
                            <>
                                <h2>Hello, Doctor. How can I assist?</h2>
                                <p>Ask general clinical questions, drug interactions, treatment guidelines, or differential diagnoses.</p>
                            </>
                        ) : (
                            <>
                                <h2>Hello! I&apos;m your health assistant.</h2>
                                <p>Ask me anything about your medical history. I&apos;ll cite sources from your records.</p>
                            </>
                        )}
                        <div className={styles.suggestions}>
                            {suggestedQuestions.map((q, i) => (
                                <button key={i} className={styles.suggestion} onClick={() => setInput(q)}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={styles.messages}>
                        {messages.map((msg) => (
                            <div key={msg.messageId} className={`${styles.message} ${styles[msg.role]}`}>
                                <div className={styles.messageContent}>
                                    {msg.role === "assistant" ? (
                                        <div className={styles.messageText}>
                                            {renderContent(msg.content, msg.citations, onNavigate)}
                                        </div>
                                    ) : (
                                        <p className={styles.messageText}>{msg.content}</p>
                                    )}
                                    {msg.citations && msg.citations.length > 0 && (
                                        <div className={styles.citations}>
                                            <span className={styles.citationLabel}><Paperclip size={12} /> Sources:</span>
                                            {msg.citations.map((c, i) => (
                                                <button key={i} className={styles.citation} onClick={() => onNavigate(`entry/${c.entryId}`)}>
                                                    {c.entryTitle} ({c.date?.slice(0, 10)})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className={styles.messageTime}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className={`${styles.message} ${styles.assistant}`}>
                                <div className={styles.typing}>
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className={styles.disclaimer}>
                <Cross size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                AI-generated, not medical advice. Always consult a healthcare professional.
            </div>

            <form className={styles.inputArea} onSubmit={handleSubmit}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder={
                        hasPatientContext
                            ? `Ask about ${doctorPatientContext!.name.split(" ")[0]}'s health...`
                            : isGeneralMode
                            ? "Ask a clinical question..."
                            : "Ask about your health..."
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                />
                <button type="submit" className={styles.sendButton} disabled={!input.trim() || isLoading}>
                    <ArrowUp size={18} />
                </button>
            </form>
        </div>
    );
}
