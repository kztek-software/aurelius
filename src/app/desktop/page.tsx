"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Command,
  Plus,
  Search,
  Calculator,
  FileText,
  Keyboard,
  Layers,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CommandPalette } from "@/components/desktop/command-palette";
import { ShortcutsModal } from "@/components/desktop/shortcuts-modal";
import { DesktopSplitView } from "@/components/desktop/desktop-split-view";
import { DesktopStatusBar } from "@/components/desktop/desktop-status-bar";
import { SmartWorkCalculator } from "@/components/desktop/smart-work-calculator";
import { DesktopScratchpad } from "@/components/desktop/desktop-scratchpad";

export default function DesktopWorkstationPage() {
  const router = useRouter();

  // Data states
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Panels states
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const resProjects = await fetch("/api/projects");
      if (resProjects.ok) {
        const pData = await resProjects.json();
        const pList = Array.isArray(pData) ? pData : pData.projects || [];
        setProjects(pList);
        if (pList.length > 0 && !currentProject) {
          setCurrentProject(pList[0]);
          loadProjectDetails(pList[0].id);
        }
      }

      const resTickets = await fetch("/api/tickets");
      if (resTickets.ok) {
        const tData = await resTickets.json();
        setTickets(Array.isArray(tData) ? tData : tData.tickets || []);
      }
    } catch (err) {
      console.error("Error loading desktop data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectDetails = async (projectId: string) => {
    try {
      const [resTasks, resSprints] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/sprints`),
      ]);

      if (resTasks.ok) {
        const tasksData = await resTasks.json();
        const tList = Array.isArray(tasksData) ? tasksData : tasksData.tasks || [];
        setTasks(tList);
        if (tList.length > 0 && !selectedTask) {
          setSelectedTask(tList[0]);
        }
      }

      if (resSprints.ok) {
        const sprintsData = await resSprints.json();
        setSprints(Array.isArray(sprintsData) ? sprintsData : sprintsData.sprints || []);
      }
    } catch (err) {
      console.error("Error loading project details:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được biên async
    fetchData();
  }, []);

  // Update task status handler
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev: any) => ({ ...prev, status: newStatus }));
      }

      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Create new task handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !currentProject) return;

    try {
      const res = await fetch(`/api/projects/${currentProject.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          priority: newTaskPriority,
          status: "TODO",
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setSelectedTask(created);
        setNewTaskTitle("");
        setNewTaskDesc("");
        setIsCreateTaskModalOpen(false);
      }
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  // Global Keyboard Shortcuts Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === "input" || targetTag === "textarea" || (e.target as HTMLElement)?.isContentEditable;

      // Ctrl + K / Cmd + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Alt + C -> Smart Calculator
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIsCalculatorOpen((prev) => !prev);
        return;
      }

      // Alt + S -> Scratchpad
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsScratchpadOpen((prev) => !prev);
        return;
      }

      // Shortcuts help (? or Ctrl+/)
      if ((e.key === "?" && !isInput) || ((e.ctrlKey || e.metaKey) && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // 'c' or 'C' for Create Task when not inside input
      if (e.key.toLowerCase() === "c" && !isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsCreateTaskModalOpen(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none font-sans">
      {/* Top Workstation Header */}
      <header className="h-12 bg-[#1A1438] border-b border-[#312564] px-4 flex items-center justify-between z-20 flex-shrink-0">
        {/* Brand & Project Selector */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors"
            title="Quay lại giao diện thông thường"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#251C53] to-[#F05922] flex items-center justify-center text-white font-bold text-xs shadow-md border border-white/20">
              KZ
            </div>
            <span className="font-bold text-sm text-white hidden sm:inline">KZTEK Work</span>
          </button>

          <span className="text-zinc-600">/</span>

          {/* Desktop Workstation Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#251C53] border border-[#48378A] text-white text-xs font-semibold shadow-inner">
            <Monitor className="w-3.5 h-3.5 text-orange-400" />
            <span>Desktop Workstation</span>
          </div>

          {/* Project Dropdown */}
          {projects.length > 0 && (
            <Dropdown
              value={currentProject?.id || ""}
              options={projects.map((p) => ({
                label: `📁 ${p.name} (${p.key || "KZ"})`,
                value: p.id,
              }))}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.value);
                if (found) {
                  setCurrentProject(found);
                  loadProjectDetails(found.id);
                }
              }}
              placeholder="Chọn dự án"
              className="p-inputtext-sm h-8 text-xs font-medium bg-surface-2 border border-line rounded-lg"
            />
          )}
        </div>

        {/* Global Search / Command Palette Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 transition-all shadow-inner"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-accent" />
              <span>Tìm kiếm tác vụ, dự án, tickets hoặc gõ lệnh...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-300">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Tools Action Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F05922] hover:bg-[#d94e1d] text-white rounded-lg text-xs font-bold shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Việc mới</span>
            <kbd className="hidden lg:inline-block px-1 bg-white/20 rounded text-[9px] font-mono">C</kbd>
          </button>

          <button
            type="button"
            onClick={() => setIsCalculatorOpen((prev) => !prev)}
            className={`p-2 rounded-lg border transition-all ${
              isCalculatorOpen
                ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                : "bg-zinc-900/60 border-zinc-750 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Mở Máy Tính Nổi (Alt+C)"
          >
            <Calculator className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsScratchpadOpen((prev) => !prev)}
            className={`p-2 rounded-lg border transition-all ${
              isScratchpadOpen
                ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                : "bg-zinc-900/60 border-zinc-750 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Mở Ghi Chú Nhanh (Alt+S)"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Trợ giúp phím tắt (? / Ctrl+/)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Dual-Pane Workstation Area */}
      <main className="flex-1 overflow-hidden relative flex">
        <DesktopSplitView
          project={currentProject}
          tasks={tasks}
          tickets={tickets}
          sprints={sprints}
          onSelectTask={(task) => setSelectedTask(task)}
          selectedTask={selectedTask}
          onOpenNewTask={() => setIsCreateTaskModalOpen(true)}
          onUpdateTaskStatus={handleUpdateTaskStatus}
        />

        {/* Floating Smart Work Calculator Widget */}
        {isCalculatorOpen && (
          <SmartWorkCalculator onClose={() => setIsCalculatorOpen(false)} />
        )}

        {/* Floating Desktop Scratchpad Widget */}
        {isScratchpadOpen && (
          <DesktopScratchpad onClose={() => setIsScratchpadOpen(false)} />
        )}
      </main>

      {/* System Status Bar & Dock at Bottom */}
      <DesktopStatusBar
        currentProjectName={currentProject ? `${currentProject.name} (${currentProject.key || "KZ"})` : "KZTEK Work"}
        onToggleCalculator={() => setIsCalculatorOpen((prev) => !prev)}
        onToggleScratchpad={() => setIsScratchpadOpen((prev) => !prev)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onOpenScratchpad={() => setIsScratchpadOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenNewTask={() => setIsCreateTaskModalOpen(true)}
        projects={projects}
      />

      {/* Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Quick New Task Modal */}
      <Dialog
        visible={isCreateTaskModalOpen}
        onHide={() => setIsCreateTaskModalOpen(false)}
        header={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Plus className="w-4 h-4 text-accent" />
            <span>Tạo Công Việc Nhanh Trên Máy Tính</span>
          </div>
        }
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl overflow-hidden"
        contentClassName="p-5"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="quickTaskTitle" className="text-xs font-semibold text-foreground">
              Tiêu đề công việc *
            </Label>
            <Input
              id="quickTaskTitle"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nhập tiêu đề công việc..."
              className="text-xs h-9"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="quickTaskDesc" className="text-xs font-semibold text-foreground">
              Mô tả chi tiết
            </Label>
            <Textarea
              id="quickTaskDesc"
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Mô tả công việc cần làm..."
              className="text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="quickTaskPriority" className="text-xs font-semibold text-foreground">
              Độ ưu tiên
            </Label>
            <Dropdown
              id="quickTaskPriority"
              value={newTaskPriority}
              options={[
                { label: "Thấp (Low)", value: "LOW" },
                { label: "Trung bình (Medium)", value: "MEDIUM" },
                { label: "Cao (High)", value: "HIGH" },
                { label: "Khẩn cấp (Urgent)", value: "URGENT" },
              ]}
              onChange={(e) => setNewTaskPriority(e.value)}
              className="w-full h-9 text-xs bg-surface-2 border border-line rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateTaskModalOpen(false)}
              className="text-xs cursor-pointer"
            >
              Hủy (Esc)
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-sm cursor-pointer"
            >
              Tạo công việc
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
