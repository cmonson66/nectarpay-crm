import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Rich-text editor for knowledge articles (TipTap). Value is HTML. */
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "doc-prose max-w-none px-4 py-3 outline-none min-h-[240px] [&_.ProseMirror]:outline-none",
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor?.isActive("bold") ?? false,
      italic: ctx.editor?.isActive("italic") ?? false,
      strike: ctx.editor?.isActive("strike") ?? false,
      h2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      h3: ctx.editor?.isActive("heading", { level: 3 }) ?? false,
      bullet: ctx.editor?.isActive("bulletList") ?? false,
      ordered: ctx.editor?.isActive("orderedList") ?? false,
      quote: ctx.editor?.isActive("blockquote") ?? false,
      link: ctx.editor?.isActive("link") ?? false,
    }),
  }) ?? {
    bold: false,
    italic: false,
    strike: false,
    h2: false,
    h3: false,
    bullet: false,
    ordered: false,
    quote: false,
    link: false,
  };

  const setLink = () => {
    if (!editor) return;
    if (state.link) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL", "https://");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const tools = editor
    ? ([
        { icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run(), label: "Bold" },
        { icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run(), label: "Italic" },
        { icon: Strikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run(), label: "Strikethrough" },
        { icon: Heading2, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), label: "Heading" },
        { icon: Heading3, active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), label: "Subheading" },
        { icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run(), label: "Bullet list" },
        { icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run(), label: "Numbered list" },
        { icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run(), label: "Quote" },
        { icon: Link2, active: state.link, run: setLink, label: "Link" },
        { icon: Undo2, active: false, run: () => editor.chain().focus().undo().run(), label: "Undo" },
        { icon: Redo2, active: false, run: () => editor.chain().focus().redo().run(), label: "Redo" },
      ] as const)
    : [];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-inset focus-within:border-honey/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-chip/40 px-2 py-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={t.run}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition-colors",
              t.active
                ? "bg-honey/20 text-honey-text"
                : "text-muted-foreground hover:bg-chip hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
