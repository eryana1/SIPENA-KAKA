import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect } from "react";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Undo, 
  Redo, 
  AlignLeft, 
  AlignRight, 
  AlignCenter 
} from "lucide-react";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[400px] p-6 bg-white border border-slate-200 rounded-b-lg shadow-inner",
      },
    },
  });

  // Update content if changed from outside (e.g. AI Generated)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Microsoft 365 style Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b border-slate-200 p-2 text-slate-700">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition ${editor.isActive("bold") ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Tebal (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition ${editor.isActive("italic") ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Miring (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded transition ${editor.isActive("underline") ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Garis Bawah (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <div className="h-6 w-[1px] bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition ${editor.isActive("heading", { level: 1 }) ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition ${editor.isActive("heading", { level: 2 }) ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="h-6 w-[1px] bg-slate-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition ${editor.isActive("bulletList") ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition ${editor.isActive("orderedList") ? "bg-blue-100 text-blue-700 font-bold" : "hover:bg-slate-200"}`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="h-6 w-[1px] bg-slate-300 mx-1" />

        {/* Action controls */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40 transition"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40 transition"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
