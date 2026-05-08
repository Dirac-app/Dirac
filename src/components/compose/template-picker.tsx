"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Edit2,
  Cloud,
  CloudOff,
  Check,
  X,
} from "lucide-react";
import {
  EmailTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
  loadTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateByShortcut,
  getTemplateSyncEnabled,
  setTemplateSyncEnabled,
  syncTemplatesToDb,
  initializeDefaultTemplates,
} from "@/lib/email-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  onInsert?: (content: string) => void;
}

export function TemplatePicker({ onInsert }: TemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | "all">("all");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Load templates on mount
  useEffect(() => {
    initializeDefaultTemplates();
    setTemplates(loadTemplates());
    setSyncEnabled(getTemplateSyncEnabled());
  }, []);

  // Handle shortcut detection in body
  const checkShortcuts = useCallback((text: string): string => {
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith("/")) {
      const template = getTemplateByShortcut(lastWord);
      if (template) {
        // Replace the shortcut with the template content
        words[words.length - 1] = template.content;
        return words.join(" ");
      }
    }
    return text;
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      search === "" ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()) ||
      (t.shortcut && t.shortcut.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Handle insert
  const handleInsert = (template: EmailTemplate) => {
    if (onInsert) {
      onInsert(template.content);
    }
    setIsOpen(false);
  };

  // Handle sync
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncTemplatesToDb();
    setSyncMessage(result.success ? `Synced ${result.count} templates` : result.error ?? "Sync failed");
    setSyncing(false);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  // Handle toggle sync
  const handleToggleSync = (enabled: boolean) => {
    setTemplateSyncEnabled(enabled);
    setSyncEnabled(enabled);
  };

  // Refresh templates list
  const refreshTemplates = () => {
    setTemplates(loadTemplates());
  };

  // Handle create template
  const handleCreate = (data: { title: string; content: string; category: TemplateCategory; shortcut?: string }) => {
    createTemplate(data);
    refreshTemplates();
    setIsCreateOpen(false);
  };

  // Handle update template
  const handleUpdate = (data: { title: string; content: string; category: TemplateCategory; shortcut?: string }) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data);
      refreshTemplates();
      setEditingTemplate(null);
    }
  };

  // Handle delete template
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate(id);
      refreshTemplates();
    }
  };

  const categories: (TemplateCategory | "all")[] = [
    "all",
    "greeting",
    "follow_up",
    "meeting",
    "thank_you",
    "intro",
    "closing",
    "custom",
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <FileText className="h-4 w-4" />
        <span className="text-xs">Snippets</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Email Templates & Snippets
            </DialogTitle>
          </DialogHeader>

          {/* Sync Status */}
          <div className="flex items-center justify-between text-sm border-b pb-3">
            <div className="flex items-center gap-2">
              {syncEnabled ? (
                <>
                  <Cloud className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">Sync enabled</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Local only</span>
                </>
              )}
              {syncMessage && (
                <span className={cn("text-xs", syncMessage.includes("Synced") ? "text-green-500" : "text-red-500")}>
                  {syncMessage}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={syncEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSync(!syncEnabled)}
                className="h-7 text-xs"
              >
                {syncEnabled ? "Syncing On" : "Sync Off"}
              </Button>
              {syncEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-7 text-xs"
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              )}
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2 pb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates or type /shortcut..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as TemplateCategory | "all")}
              className="px-3 py-2 text-sm rounded-md border bg-background"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : TEMPLATE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No templates found</p>
                <p className="text-sm">Create your first template to get started</p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{template.title}</h4>
                        {template.shortcut && (
                          <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {template.shortcut}
                          </code>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {TEMPLATE_CATEGORY_LABELS[template.category]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.content.replace(/\n/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => handleInsert(template)}
                  >
                    Insert Template
                  </Button>
                </div>
              ))
            )}
          </div>

          <Separator />

          {/* Create New */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create New Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <TemplateFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
        title="Create Template"
      />

      {/* Edit Dialog */}
      {editingTemplate && (
        <TemplateFormDialog
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
          onSubmit={handleUpdate}
          title="Edit Template"
          defaultValues={editingTemplate}
        />
      )}
    </>
  );
}

// Template Form Dialog Component
interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; content: string; category: TemplateCategory; shortcut?: string }) => void;
  title: string;
  defaultValues?: EmailTemplate;
}

function TemplateFormDialog({ open, onOpenChange, onSubmit, title, defaultValues }: TemplateFormDialogProps) {
  const [titleInput, setTitleInput] = useState(defaultValues?.title ?? "");
  const [content, setContent] = useState(defaultValues?.content ?? "");
  const [category, setCategory] = useState<TemplateCategory>(defaultValues?.category ?? "custom");
  const [shortcut, setShortcut] = useState(defaultValues?.shortcut ?? "");

  // Reset form when dialog opens/closes or defaultValues change
  useEffect(() => {
    if (open) {
      setTitleInput(defaultValues?.title ?? "");
      setContent(defaultValues?.content ?? "");
      setCategory(defaultValues?.category ?? "custom");
      setShortcut(defaultValues?.shortcut ?? "");
    }
  }, [open, defaultValues]);

  const handleSubmit = () => {
    if (!titleInput.trim() || !content.trim()) return;
    onSubmit({
      title: titleInput.trim(),
      content: content.trim(),
      category,
      shortcut: shortcut.trim() || undefined,
    });
  };

  const categories: TemplateCategory[] = [
    "greeting",
    "follow_up",
    "meeting",
    "thank_you",
    "intro",
    "closing",
    "custom",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Template name"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Content</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Template content... Use variables like {{name}} for personalization"
              className="mt-1 min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border bg-background"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {TEMPLATE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Shortcut (optional)</label>
              <Input
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="/shortcut"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Type in compose to auto-insert</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!titleInput.trim() || !content.trim()}>
              {defaultValues ? "Save Changes" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePicker;
