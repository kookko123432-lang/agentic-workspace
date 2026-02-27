import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Plus,
  MessageSquare,
  Settings,
  Trash2,
  ChevronRight,
  Send,
  Bot,
  User,
  LayoutDashboard,
  Folder as FolderIcon,
  X,
  Users,
  Building2,
  ArrowUpCircle,
  ChevronDown,
  FileText,
  MoreVertical,
  Key,
  Eye,
  EyeOff,
  Globe,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Folder, Agent, Message, Room } from './types';
import * as storage from './storage';
import { type AISettings, type AIProvider, PROVIDERS, getAISettings, saveAISettings, getProviderInfo, generateAIResponse } from './ai-providers';
import { exportAllData, importAllData } from './data-export';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [roomAgents, setRoomAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(window.innerWidth > 1024);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(getAISettings);
  const [showApiKey, setShowApiKey] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ─── Export/Import handlers ─────────────────────────────────

  const handleExport = async () => {
    try {
      await exportAllData();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('This will replace all current data with the backup. Are you sure?')) {
      e.target.value = '';
      return;
    }
    try {
      const result = await importAllData(file);
      alert(result);
      // Reload all data
      loadFolders();
      setActiveFolder(null);
      setAiSettings(getAISettings());
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  };

  useEffect(() => {
    loadFolders();
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
        setIsAgentSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
        setIsAgentSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeFolder) {
      loadRooms(activeFolder.id);
      loadAgents(activeFolder.id);
      if (window.innerWidth <= 768) {
        setIsSidebarOpen(false);
      }
    } else {
      setRooms([]);
      setAgents([]);
      setMessages([]);
      setActiveRoom(null);
      setActiveAgent(null);
    }
  }, [activeFolder]);

  useEffect(() => {
    if (activeRoom) {
      loadMessages(activeRoom.id);
      loadRoomAgents(activeRoom.id);
      if (window.innerWidth <= 1024) {
        setIsAgentSidebarOpen(false);
      }
    } else {
      setMessages([]);
      setRoomAgents([]);
    }
  }, [activeRoom]);

  // ─── localStorage-based data functions ─────────────────────

  const loadFolders = () => {
    setFolders(storage.getFolders());
  };

  const loadRooms = (folderId: string) => {
    setRooms(storage.getRooms(folderId));
  };

  const loadAgents = (folderId: string) => {
    setAgents(storage.getAgents(folderId));
  };

  const loadRoomAgents = (roomId: string) => {
    const agentIds = storage.getRoomAgentIds(roomId);
    const allAgents = storage.getAllAgents();
    setRoomAgents(allAgents.filter(a => agentIds.includes(a.id)));
  };

  const loadMessages = (roomId: string) => {
    setMessages(storage.getMessages(roomId));
  };

  const createFolder = (name: string, description: string, parentId?: string) => {
    if (!name.trim()) return;
    setIsCreatingFolder(true);
    try {
      const id = generateId();
      const newFolder: Folder = {
        id,
        name,
        description,
        parent_id: parentId || null,
        created_at: new Date().toISOString(),
      };
      storage.addFolder(newFolder);

      // Create a default 'Company Chat' room
      const roomId = generateId();
      const companyRoom: Room = {
        id: roomId,
        folder_id: id,
        name: 'Company Chat',
        type: 'company',
        created_at: new Date().toISOString(),
      };
      storage.addRoom(companyRoom);

      // Create a default Assistant agent
      const assistantId = generateId();
      const assistant: Agent = {
        id: assistantId,
        folder_id: id,
        name: 'Workspace Assistant',
        role: 'Project Coordinator',
        system_instruction: 'You are the primary assistant for this workspace. You help with meeting minutes, file management, and coordination.',
        is_assistant: true,
      };
      storage.addAgent(assistant);

      // Add assistant to company chat
      storage.addRoomAgent(roomId, assistantId);

      loadFolders();
      setActiveFolder(newFolder);
      setShowNewFolderModal(false);
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const upgradeToDepartment = (agentId: string, folderName: string) => {
    const agent = storage.getAgentById(agentId);
    if (!agent) return;

    const newFolderId = generateId();
    const newFolder: Folder = {
      id: newFolderId,
      name: folderName,
      description: `Department for ${agent.name}`,
      parent_id: agent.folder_id,
      created_at: new Date().toISOString(),
    };
    storage.addFolder(newFolder);

    // Move agent to new folder
    storage.updateAgentFolder(agentId, newFolderId);

    // Create default meeting room
    const roomId = generateId();
    storage.addRoom({
      id: roomId,
      folder_id: newFolderId,
      name: 'Department Meeting',
      type: 'meeting',
      created_at: new Date().toISOString(),
    }, [agentId]);

    // Create default Company Chat
    const companyRoomId = generateId();
    storage.addRoom({
      id: companyRoomId,
      folder_id: newFolderId,
      name: 'Department Chat',
      type: 'company',
      created_at: new Date().toISOString(),
    });

    // Create a default Assistant for this department
    const assistantId = generateId();
    const deptAssistant: Agent = {
      id: assistantId,
      folder_id: newFolderId,
      name: 'Dept Assistant',
      role: 'Department Coordinator',
      system_instruction: 'You are the primary assistant for this department. You help with meeting minutes and coordination.',
      is_assistant: true,
    };
    storage.addAgent(deptAssistant);

    // Add agent and assistant to the meeting room
    storage.addRoomAgent(roomId, assistantId);

    // Add assistant to company chat
    storage.addRoomAgent(companyRoomId, assistantId);

    loadFolders();
    setShowUpgradeModal(false);
  };

  const createRoom = (name: string, type: 'meeting' | 'company' | 'direct', agentIds: string[]) => {
    if (!activeFolder) return;

    // Auto-add assistant to meeting rooms
    let finalAgentIds = [...agentIds];
    if (type === 'meeting') {
      const assistant = agents.find(a => a.is_assistant);
      if (assistant && !finalAgentIds.includes(assistant.id)) {
        finalAgentIds.push(assistant.id);
      }
    }

    const id = generateId();
    const newRoom: Room = {
      id,
      folder_id: activeFolder.id,
      name,
      type,
      created_at: new Date().toISOString(),
    };
    storage.addRoom(newRoom, finalAgentIds);
    loadRooms(activeFolder.id);
    setShowNewRoomModal(false);
  };

  const deleteFolder = (id: string) => {
    storage.removeFolder(id);
    if (activeFolder?.id === id) setActiveFolder(null);
    loadFolders();
  };

  const createAgent = (name: string, role: string, instruction: string) => {
    if (!activeFolder) return;
    const id = generateId();
    const newAgent: Agent = {
      id,
      folder_id: activeFolder.id,
      name,
      role,
      system_instruction: instruction,
      is_assistant: false,
    };
    storage.addAgent(newAgent);
    loadAgents(activeFolder.id);
    setShowNewAgentModal(false);
  };

  const deleteAgent = (id: string) => {
    storage.removeAgent(id);
    if (activeAgent?.id === id) setActiveAgent(null);
    if (activeFolder) loadAgents(activeFolder.id);
  };

  const toggleMessageCollapse = (id: string) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent || inputValue;
    if (!content.trim() || !activeFolder || !activeRoom || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      room_id: activeRoom.id,
      agent_id: null,
      role: 'user',
      content: content,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    storage.addMessage(userMessage);
    const currentInput = content;
    setInputValue('');
    setIsLoading(true);

    try {
      // Determine which agents should respond
      let targetAgents = roomAgents;

      // If it's a company chat and there's an @mention, only that agent responds
      if (activeRoom.type === 'company') {
        const mentionMatch = currentInput.match(/@(\w+)/);
        if (mentionMatch) {
          const mentionedName = mentionMatch[1].toLowerCase();
          const mentionedAgent = agents.find(a => a.name.toLowerCase().includes(mentionedName));
          if (mentionedAgent) {
            targetAgents = [mentionedAgent];
          }
        } else {
          // If no mention in company chat, only the assistant responds
          targetAgents = roomAgents.filter(a => a.is_assistant);
        }
      }

      for (const agent of targetAgents) {
        const contextMessages = messages.map(m => ({
          role: m.role as 'user' | 'model',
          content: `[${m.agent_id ? agents.find(a => a.id === m.agent_id)?.name : 'User'}]: ${m.content}`,
        }));

        contextMessages.push({
          role: 'user' as const,
          content: `[User]: ${userMessage.content}`,
        });

        const systemInstruction = `You are ${agent.name}, the ${agent.role}. 
        ${agent.is_assistant ? "You are the meeting assistant. Help with minutes and coordination." : ""}
        Your specific instructions: ${agent.system_instruction}.
        You are in the room "${activeRoom.name}" (Type: ${activeRoom.type}) within project "${activeFolder.name}".
        Other agents in this room: ${roomAgents.map(a => `${a.name} (${a.role})`).join(', ')}.
        Respond to the user's message appropriately. If you are the assistant and the user asks to "end meeting" or "generate minutes", summarize the discussion.`;

        const aiContent = await generateAIResponse(aiSettings, contextMessages, systemInstruction);
        const aiMessage: Message = {
          id: generateId(),
          room_id: activeRoom.id,
          agent_id: agent.id,
          role: 'model',
          content: aiContent,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, aiMessage]);
        storage.addMessage(aiMessage);
      }

    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden">
      {/* Project Sidebar (Drawer on mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 280 : 0,
          x: isSidebarOpen ? 0 : -280
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className={`bg-[#141414] text-[#E4E3E0] flex flex-col border-r border-[#141414]/10 fixed md:relative h-full z-50 overflow-hidden`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <LayoutDashboard className="w-6 h-6" />
            <span>Agentic</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-mono uppercase tracking-widest opacity-50">Projects</h2>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="hover:bg-white/10 p-1 rounded transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {folders.map(folder => (
              <div key={folder.id} className="space-y-1">
                <div
                  onClick={() => setActiveFolder(folder)}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${activeFolder?.id === folder.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/70'
                    }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {folder.parent_id ? <Building2 className="w-4 h-4 text-amber-400" /> : <FolderIcon className={`w-4 h-4 flex-shrink-0 ${activeFolder?.id === folder.id ? 'text-emerald-400' : ''}`} />}
                    <span className="truncate text-sm font-medium">{folder.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {activeFolder?.id === folder.id && (
                  <div className="ml-6 border-l border-white/10 pl-2 space-y-1">
                    {folders.filter(f => f.parent_id === folder.id).map(dept => (
                      <div
                        key={dept.id}
                        onClick={() => setActiveFolder(dept)}
                        className="p-1.5 text-xs text-white/50 hover:text-white cursor-pointer truncate"
                      >
                        └ {dept.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          {/* Export/Import buttons */}
          <div className="flex gap-2 px-2">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"
              title="Export all data as ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"
              title="Import data from ZIP backup"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".zip"
              onChange={handleImport}
              className="hidden"
            />
          </div>
          {/* User profile */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-[#141414] font-bold text-xs">
              S
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Shawn</p>
              <p className="text-[10px] opacity-50 truncate">shawn8585885@gmail.com</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F5F5F3]">
        {activeFolder ? (
          <>
            {/* Header */}
            <header className="h-16 border-b border-[#141414]/5 px-4 md:px-6 flex items-center justify-between bg-white shadow-sm z-30">
              <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </button>
                <div className="overflow-hidden">
                  <h1 className="text-sm md:text-lg font-bold truncate">
                    {activeFolder.name} {activeRoom ? `> ${activeRoom.name}` : ''}
                  </h1>
                  <p className="text-[10px] md:text-xs text-gray-500 truncate max-w-[150px] md:max-w-md">{activeFolder.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                {activeRoom?.type === 'meeting' && (
                  <button
                    onClick={() => {
                      sendMessage("Please generate the meeting minutes for our discussion so far.");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Minutes</span>
                  </button>
                )}
                <button
                  onClick={() => setIsAgentSidebarOpen(!isAgentSidebarOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                >
                  <Bot className="w-5 h-5 text-gray-400" />
                </button>
                <button onClick={() => setShowSettingsModal(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="AI Settings">
                  <Settings className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
              {/* Agents & Rooms Sidebar */}
              <AnimatePresence>
                {isAgentSidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAgentSidebarOpen(false)}
                    className="fixed inset-0 bg-black/20 z-30 lg:hidden"
                  />
                )}
              </AnimatePresence>

              <motion.div
                initial={false}
                animate={{
                  width: isAgentSidebarOpen ? 260 : 0,
                  x: isAgentSidebarOpen ? 0 : -260
                }}
                className="border-r border-[#141414]/5 bg-white/80 backdrop-blur-md flex flex-col fixed lg:relative h-full z-40 overflow-hidden"
              >
                <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                  {/* Rooms Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Meeting Center</h2>
                      <button onClick={() => setShowNewRoomModal(true)} className="p-1 hover:bg-gray-200 rounded transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {rooms.map(room => (
                        <div
                          key={room.id}
                          onClick={() => setActiveRoom(room)}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-all ${activeRoom?.id === room.id ? 'bg-[#141414] text-white' : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        >
                          {room.type === 'meeting' ? <Users className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                          <span className="truncate font-medium">{room.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agents Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Agents</h2>
                      <button onClick={() => setShowNewAgentModal(true)} className="p-1 hover:bg-gray-200 rounded transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {agents.map(agent => (
                        <div
                          key={agent.id}
                          onClick={() => {
                            // Find or create a direct room for this agent
                            const existingRoom = rooms.find(r => r.type === 'direct' && r.name === agent.name);
                            if (existingRoom) {
                              setActiveRoom(existingRoom);
                            } else {
                              createRoom(agent.name, 'direct', [agent.id]);
                            }
                          }}
                          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${activeRoom?.name === agent.name ? 'bg-[#141414] text-white shadow-md' : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${agent.is_assistant ? 'bg-amber-100 text-amber-700' : 'bg-gray-200'
                              }`}>
                              <Bot className="w-3 h-3" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold truncate">{agent.name}</p>
                              <p className="text-[9px] opacity-60 truncate">{agent.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveAgent(agent); setShowUpgradeModal(true); }}
                              className="p-1 hover:text-amber-500"
                              title="Upgrade to Department"
                            >
                              <ArrowUpCircle className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id); }}
                              className="p-1 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="flex-1 flex flex-col bg-white relative">
                {activeRoom ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-[#141414] text-white' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                            {msg.role === 'user' ? <User className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                          </div>
                          <div className={`max-w-[85%] md:max-w-[80%] space-y-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-40">
                                  {msg.role === 'user' ? 'You' : agents.find(a => a.id === msg.agent_id)?.name}
                                </span>
                                <span className="text-[9px] md:text-[10px] opacity-30">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {msg.role === 'model' && (
                                <button onClick={() => toggleMessageCollapse(msg.id)} className="p-1 hover:bg-gray-100 rounded">
                                  <ChevronDown className={`w-3 h-3 transition-transform ${collapsedMessages.has(msg.id) ? '-rotate-90' : ''}`} />
                                </button>
                              )}
                            </div>
                            <AnimatePresence initial={false}>
                              {!collapsedMessages.has(msg.id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className={`p-3 md:p-4 rounded-2xl text-xs md:text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-[#141414] text-white rounded-tr-none'
                                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                                    }`}>
                                    <div className="markdown-body">
                                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-4">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center animate-pulse">
                            <Bot className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none animate-pulse">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 md:p-6 border-t border-[#141414]/5 bg-white">
                      <div className="max-w-4xl mx-auto relative">
                        <textarea
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          placeholder={`Message ${activeRoom.name}... Use @name to mention agents.`}
                          className="w-full bg-gray-100 border-none rounded-2xl py-3 md:py-4 pl-4 pr-14 md:pr-16 text-xs md:text-sm focus:ring-2 focus:ring-[#141414] transition-all resize-none min-h-[50px] max-h-[150px]"
                          rows={1}
                        />
                        <button
                          onClick={() => sendMessage()}
                          disabled={!inputValue.trim() || isLoading}
                          className="absolute right-2 md:right-3 bottom-2 md:bottom-3 p-2 bg-[#141414] text-white rounded-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-center mt-2 md:mt-3 text-gray-400">
                        Agents in this folder share context.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold">Select a Room or Agent</h3>
                    <p className="text-sm text-gray-500 max-w-xs mt-2">
                      Choose a meeting room or an agent from the sidebar to start collaborating.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col relative">
            {/* Mobile Menu Button for Welcome Screen */}
            <div className="md:hidden p-4 absolute top-0 left-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-white rounded-lg shadow-sm border border-gray-100"
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-gray-200 rounded-3xl flex items-center justify-center mb-6">
                <FolderIcon className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold">Welcome to Agentic</h2>
              <p className="text-gray-500 max-w-md mt-2">
                Create a project folder to start building your AI team.
                Each folder acts as a shared workspace for your agents.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[#141414] text-white rounded-2xl hover:scale-105 transition-all shadow-xl"
                >
                  <FolderPlus className="w-5 h-5" />
                  <span>Create New Project</span>
                </button>
                {folders.length > 0 && (
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="md:hidden flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#141414] border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all"
                  >
                    <FolderIcon className="w-5 h-5" />
                    <span>Open Existing Project</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">New Project Folder</h3>
                <button onClick={() => setShowNewFolderModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createFolder(formData.get('name') as string, formData.get('description') as string);
                }}
                className="p-6 space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Project Name</label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Marketing Campaign 2024"
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Description</label>
                  <textarea
                    name="description"
                    placeholder="What is this project about?"
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414] h-24 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="w-full py-3 bg-[#141414] text-white rounded-xl font-bold hover:bg-black transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingFolder ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Folder'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showNewAgentModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">Add AI Agent</h3>
                <button onClick={() => setShowNewAgentModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createAgent(
                    formData.get('name') as string,
                    formData.get('role') as string,
                    formData.get('instruction') as string
                  );
                }}
                className="p-6 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-40">Agent Name</label>
                    <input
                      name="name"
                      required
                      placeholder="e.g. Alex"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-40">Professional Role</label>
                    <input
                      name="role"
                      required
                      placeholder="e.g. Marketing Lead"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">System Instructions</label>
                  <textarea
                    name="instruction"
                    required
                    placeholder="Define the agent's personality, knowledge, and goals..."
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414] h-32 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#141414] text-white rounded-xl font-bold hover:bg-black transition-all mt-4"
                >
                  Deploy Agent
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showNewRoomModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">New Meeting Room</h3>
                <button onClick={() => setShowNewRoomModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const selectedAgents = Array.from(formData.getAll('agent_ids')) as string[];
                  createRoom(
                    formData.get('name') as string,
                    'meeting',
                    selectedAgents
                  );
                }}
                className="p-6 space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Room Name</label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Strategy Sync"
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Participants</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-xl">
                    {agents.map(agent => (
                      <label key={agent.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="agent_ids" value={agent.id} className="rounded text-[#141414]" />
                        <span>{agent.name} ({agent.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-[#141414] text-white rounded-xl font-bold hover:bg-black transition-all mt-4"
                >
                  Create Room
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showUpgradeModal && activeAgent && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">Upgrade to Department</h3>
                <button onClick={() => setShowUpgradeModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">
                  This will create a new department folder for <strong>{activeAgent.name}</strong>.
                  A dedicated meeting room will be automatically created.
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Department Name</label>
                  <input
                    id="deptName"
                    defaultValue={`${activeAgent.name}'s Department`}
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                  />
                </div>
                <button
                  onClick={() => {
                    const name = (document.getElementById('deptName') as HTMLInputElement).value;
                    upgradeToDepartment(activeAgent.id, name);
                  }}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all mt-4 flex items-center justify-center gap-2"
                >
                  <ArrowUpCircle className="w-5 h-5" />
                  Confirm Upgrade
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <h3 className="text-lg font-bold">AI Provider Settings</h3>
                </div>
                <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Provider</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          const newSettings = {
                            ...aiSettings,
                            provider: p.id,
                            model: p.defaultModel,
                            apiKey: p.id === aiSettings.provider ? aiSettings.apiKey : '',
                          };
                          setAiSettings(newSettings);
                        }}
                        className={`p-3 rounded-xl text-left transition-all border-2 ${aiSettings.provider === p.id
                          ? 'border-[#141414] bg-[#141414] text-white'
                          : 'border-gray-100 hover:border-gray-300 bg-gray-50'
                          }`}
                      >
                        <p className="text-xs font-bold truncate">{p.name}</p>
                        {p.defaultModel && <p className="text-[9px] opacity-60 mt-0.5">{p.defaultModel}</p>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40 flex items-center gap-1">
                    <Key className="w-3 h-3" /> API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={aiSettings.apiKey}
                      onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                      placeholder={getProviderInfo(aiSettings.provider).placeholder}
                      className="w-full bg-gray-50 border-none rounded-xl p-3 pr-10 text-sm focus:ring-2 focus:ring-[#141414] font-mono"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-40">Model</label>
                  {getProviderInfo(aiSettings.provider).models.length > 0 ? (
                    <select
                      value={aiSettings.model}
                      onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                    >
                      {getProviderInfo(aiSettings.provider).models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={aiSettings.model}
                      onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                      placeholder="e.g. gpt-4o"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414]"
                    />
                  )}
                </div>

                {/* Custom Base URL (only for custom provider) */}
                {aiSettings.provider === 'custom' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider opacity-40 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> API Base URL
                    </label>
                    <input
                      type="text"
                      value={aiSettings.customBaseUrl}
                      onChange={(e) => setAiSettings({ ...aiSettings, customBaseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#141414] font-mono"
                    />
                  </div>
                )}

                {/* Current Status */}
                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${aiSettings.apiKey ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="text-xs text-gray-500">
                    {aiSettings.apiKey
                      ? `Using ${getProviderInfo(aiSettings.provider).name} · ${aiSettings.model}`
                      : 'No API key set'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    saveAISettings(aiSettings);
                    setShowSettingsModal(false);
                  }}
                  className="w-full py-3 bg-[#141414] text-white rounded-xl font-bold hover:bg-black transition-all"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
