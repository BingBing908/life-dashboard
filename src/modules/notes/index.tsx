import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CARD_BTN, PAGE, READ_BODY, READ_TITLE } from "@/lib/ui";
import { useSubPath } from "@/lib/hashRoute";
import type { AppModule } from "../types";
import {
  createNote,
  deleteNote,
  listNotes,
  noteTitle,
  notePreview,
  noteWhen,
  setNotePinned,
  updateNoteBody,
  type Note,
} from "./data";

function Card() {
  const [notes, setNotes] = useState<Note[] | null>(null);

  useEffect(() => {
    listNotes().then(setNotes).catch(() => setNotes([]));
  }, []);

  if (notes === null) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (notes.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        随手记一大段：想到的修改建议、会议记录、待整理的东西。
      </p>
    );
  return (
    <div className="text-sm text-muted-foreground">
      共 {notes.length} 条 · 最近：{noteTitle(notes[0].body)}
    </div>
  );
}

/**
 * 列表里的一条（含可点元素的组件放模块顶层，避免父组件重渲染时重挂载）。
 *
 * ⚠️ 头行是「文本列 + 若干 shrink-0 兄弟」，所以 `flex-wrap` + 标题给 `min-w-[7rem]` 下限——
 * 裸的 `min-w-0 flex-1` 在 360px 窄屏上会被按钮挤成 0 宽、标题整条消失
 * （这个病在 ThreeRowCard / ItemRow / EntryDoc / 待办行上已经复发过四次，见 CLAUDE.md）。
 */
function NoteTile({
  note,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const preview = notePreview(note.body);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn(CARD_BTN, "group flex min-h-28 cursor-pointer flex-col gap-1.5")}
    >
      <div className="flex flex-wrap items-start gap-2">
        <p className={cn("min-w-[7rem] flex-1 break-words", READ_TITLE)}>
          {noteTitle(note.body)}
        </p>
        <span className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            title={note.pinned ? "取消置顶" : "置顶"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
          >
            <Star
              className={cn(
                "size-4",
                note.pinned ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="删除"
            className="invisible text-muted-foreground group-hover:visible hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{noteWhen(note.updated_at)}</p>
      {preview && (
        <p className="line-clamp-3 text-sm text-muted-foreground">{preview}</p>
      )}
    </div>
  );
}

/**
 * 编辑器＝一个占满屏幕的输入框，像 iPad 备忘录那样随时自动存。
 *
 * ⚠️⚠️ **非受控 textarea + `key={note.id}`，刻意不写 effect 跟 props 同步**：
 * 云同步每 30 秒拉一次，一旦把 props 回灌进输入框，她正在打的字会被冲掉
 * （三餐框踩过这个坑，见 CLAUDE.md）。所以草稿只活在 DOM 里，换一条备忘录才靠 key 重挂载。
 * ⚠️ 正因为草稿只取一次初值，**调用方必须等库读完再渲染它**——Page 只在 `notes !== null`
 * 且找得到这条时才渲染，否则会出现「库里有字、框里是空的，一存就清空」。
 *
 * ⚠️ 三餐那边用的是显式「确认提交」，这里刻意不用：备忘录是连着打一大段的东西，
 * 每改一处都要点一次按钮就没法用了。改成 600ms 防抖 + 失焦 + 离开页面时各存一次。
 */
function NoteEditor({
  note,
  onSaved,
  onTogglePin,
  onBack,
  onDelete,
}: {
  note: Note;
  onSaved: (id: string, body: string, ts: string) => void;
  onTogglePin: () => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | null>(null);
  /** 待写入的内容；null＝没有未保存的改动 */
  const pending = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const v = pending.current;
    if (v === null) return;
    pending.current = null;
    updateNoteBody(note.id, v)
      .then((ts) => {
        setDirty(false);
        onSaved(note.id, v, ts);
      })
      .catch(() => {
        pending.current = v; // 没存上就把它放回去，下次失焦/离开还会再试
      });
  }, [note.id, onSaved]);

  // 离开这一页（返回列表 / 切到别的备忘录 / 关页面）时把没存的那一下补上。
  // ⚠️ 用 ref 持最新的 flush，否则 cleanup 捕获的是首次渲染那个闭包。
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  return (
    <div className={cn(PAGE, "flex h-full flex-col")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> 备忘录
        </Button>
        <span className="min-w-[4rem] flex-1 text-xs text-muted-foreground">
          {dirty ? "保存中…" : `已保存 · ${noteWhen(note.updated_at)}`}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          title={note.pinned ? "取消置顶" : "置顶"}
          onClick={onTogglePin}
        >
          <Star
            className={cn(
              "size-4",
              note.pinned ? "fill-primary text-primary" : "text-muted-foreground",
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="删除这条"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <textarea
        key={note.id}
        defaultValue={note.body}
        autoFocus={!note.body}
        placeholder="在这里随便写……第一行会当成标题。"
        onChange={(e) => {
          pending.current = e.target.value;
          setDirty(true);
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 600);
        }}
        onBlur={flush}
        className={cn(
          "min-h-0 flex-1 resize-none rounded-xl border bg-card p-4 outline-none focus-visible:border-primary/40",
          READ_BODY,
        )}
      />
    </div>
  );
}

function Page() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [sub, nav] = useSubPath("notes");
  const openId = sub[0] ?? null;

  useEffect(() => {
    listNotes().then(setNotes).catch(() => setNotes([]));
  }, []);

  /** 存完只改本地那一条，别整表重查——重查会让列表重排、也可能把她的草稿状态搅乱 */
  const handleSaved = useCallback((id: string, body: string, ts: string) => {
    setNotes((prev) =>
      prev ? prev.map((n) => (n.id === id ? { ...n, body, updated_at: ts } : n)) : prev,
    );
  }, []);

  async function handleNew() {
    const n = await createNote();
    setNotes((prev) => [n, ...(prev ?? [])]);
    nav([n.id]); // 建完直接进编辑器，少点一下
  }

  async function handleTogglePin(n: Note) {
    await setNotePinned(n.id, !n.pinned);
    setNotes(await listNotes()); // 置顶要重排，这里整表重查是对的
  }

  async function handleDelete(n: Note) {
    const name = noteTitle(n.body);
    if (!window.confirm(`删除「${name}」？内容会一起没掉。`)) return;
    await deleteNote(n.id);
    setNotes((prev) => (prev ? prev.filter((x) => x.id !== n.id) : prev));
    if (openId === n.id) nav([]); // 删掉的正是打开着的那条 ⇒ 别停在死 id 上
  }

  // ⚠️ 带 id 进来但数据还没读完：先显示「加载中」，别闪一下列表再跳详情
  if (notes === null)
    return (
      <div className={PAGE}>
        <p className="text-muted-foreground">加载中…</p>
      </div>
    );

  if (openId) {
    const note = notes.find((n) => n.id === openId);
    if (!note)
      return (
        <div className={PAGE}>
          <Button variant="ghost" size="sm" onClick={() => nav([])}>
            <ArrowLeft className="size-4" /> 备忘录
          </Button>
          <p className="mt-4 text-muted-foreground">这条备忘录不在了（可能已删除）。</p>
        </div>
      );
    return (
      <NoteEditor
        note={note}
        onSaved={handleSaved}
        onTogglePin={() => handleTogglePin(note)}
        onBack={() => nav([])}
        onDelete={() => handleDelete(note)}
      />
    );
  }

  return (
    <div className={PAGE}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="min-w-[6rem] flex-1 text-xl font-semibold">备忘录</h2>
        <Button onClick={handleNew}>
          <Plus className="size-4" /> 新建
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          还没有备忘录。点「新建」倒一大段进去——想到的修改建议、会议记录、待整理的东西都行，
          第一行会自动当标题。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {notes.map((n) => (
            <NoteTile
              key={n.id}
              note={n}
              onOpen={() => nav([n.id])}
              onTogglePin={() => handleTogglePin(n)}
              onDelete={() => handleDelete(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const notesModule: AppModule = {
  manifest: {
    id: "notes",
    name: "备忘录",
    icon: Pencil,
    description: "随手倒一大段，第一行当标题",
    defaultSize: { w: 1, h: 1 },
  },
  Card,
  Page,
};

export default notesModule;
