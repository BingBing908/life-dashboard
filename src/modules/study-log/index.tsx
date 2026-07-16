import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayStr } from "@/lib/dates";
import type { AppModule } from "../types";
import {
  addSession,
  createSubject,
  deleteSession,
  listRecentSessions,
  listSubjects,
  minutesOnDate,
  type StudySession,
  type Subject,
} from "./data";

function Card() {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    listRecentSessions()
      .then((ss) => setMinutes(minutesOnDate(ss, todayStr())))
      .catch(() => setMinutes(0));
  }, []);

  if (minutes === null)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  return (
    <p className="text-sm text-muted-foreground">
      今日学习{" "}
      <span className="font-medium text-foreground">{minutes}</span> 分钟
    </p>
  );
}

function Page() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [newSubject, setNewSubject] = useState("");

  useEffect(() => {
    listSubjects().then((ss) => {
      setSubjects(ss);
      if (ss.length > 0) setSubjectId(ss[0].id);
    });
    listRecentSessions().then(setSessions);
  }, []);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const todayMinutes = minutesOnDate(sessions, todayStr());

  async function handleAddSubject() {
    const name = newSubject.trim();
    if (!name) return;
    const s = await createSubject(name);
    setSubjects((ss) => [...ss, s]);
    setNewSubject("");
    if (!subjectId) setSubjectId(s.id);
  }

  async function handleAddSession() {
    const mins = parseInt(minutes, 10);
    if (!mins || mins <= 0) return;
    const s = await addSession(subjectId || null, mins, note.trim() || null);
    setSessions((ss) => [s, ...ss]);
    setMinutes("");
    setNote("");
  }

  async function handleDeleteSession(id: string) {
    setSessions((ss) => ss.filter((s) => s.id !== id));
    await deleteSession(id);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-baseline gap-4">
        <h1 className="text-2xl font-semibold">学习记录</h1>
        <span className="text-muted-foreground">
          今日共 <span className="font-medium text-foreground">{todayMinutes}</span> 分钟
        </span>
      </div>

      {/* 记录一段学习 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={subjectId}
          onValueChange={(v) => setSubjectId(v ?? "")}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="选择科目" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span
                  className="mr-1 inline-block size-2 rounded-full"
                  style={{ backgroundColor: s.color ?? "#888" }}
                />
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          className="w-24"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="分钟"
        />
        <Input
          className="w-56"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSession()}
          placeholder="备注（可选）"
        />
        <Button onClick={handleAddSession}>
          <Plus className="size-4" /> 记录
        </Button>
      </div>

      {/* 新增科目 */}
      <div className="mb-6 flex max-w-xs gap-2">
        <Input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
          placeholder="新科目，如：英语"
        />
        <Button variant="outline" onClick={handleAddSubject}>
          加科目
        </Button>
      </div>

      {/* 记录列表 */}
      <div className="space-y-1.5">
        {sessions.map((s) => {
          const subject = s.subject_id ? subjectById.get(s.subject_id) : null;
          const d = new Date(s.started_at);
          return (
            <div
              key={s.id}
              className="group flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span className="w-32 text-muted-foreground">
                {d.getMonth() + 1}/{d.getDate()}{" "}
                {String(d.getHours()).padStart(2, "0")}:
                {String(d.getMinutes()).padStart(2, "0")}
              </span>
              {subject && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: subject.color ?? "#888" }}
                >
                  {subject.name}
                </span>
              )}
              <span className="font-medium">{s.minutes} 分钟</span>
              {s.note && <span className="text-muted-foreground">{s.note}</span>}
              <button
                className="invisible ml-auto text-muted-foreground hover:text-destructive group-hover:visible"
                title="删除记录"
                onClick={() => handleDeleteSession(s.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      {sessions.length === 0 && (
        <p className="mt-8 text-muted-foreground">
          还没有学习记录。先加一个科目，然后记录你的第一段学习时间。
        </p>
      )}
    </div>
  );
}

const studyLogModule: AppModule = {
  manifest: {
    id: "study-log",
    name: "学习记录",
    icon: BookOpen,
    description: "科目、时长与笔记",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default studyLogModule;
