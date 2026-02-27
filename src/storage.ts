import { Folder, Agent, Room, Message } from './types';

const KEYS = {
  folders: 'agentic_folders',
  agents: 'agentic_agents',
  rooms: 'agentic_rooms',
  roomAgents: 'agentic_room_agents',
  messages: 'agentic_messages',
};

function load<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Folders ─────────────────────────────────────────────────

export function getFolders(): Folder[] {
  return load<Folder>(KEYS.folders).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function addFolder(folder: Folder): void {
  const folders = load<Folder>(KEYS.folders);
  folders.push(folder);
  save(KEYS.folders, folders);
}

export function removeFolder(id: string): void {
  // Remove folder
  save(KEYS.folders, load<Folder>(KEYS.folders).filter(f => f.id !== id));
  // Cascade: remove rooms, agents, messages, room_agents belonging to this folder
  const rooms = load<Room>(KEYS.rooms).filter(r => r.folder_id === id);
  const roomIds = rooms.map(r => r.id);
  save(KEYS.rooms, load<Room>(KEYS.rooms).filter(r => r.folder_id !== id));
  save(KEYS.agents, load<Agent>(KEYS.agents).filter(a => a.folder_id !== id));
  save(KEYS.roomAgents, load<{ room_id: string; agent_id: string }>(KEYS.roomAgents).filter(ra => !roomIds.includes(ra.room_id)));
  save(KEYS.messages, load<Message>(KEYS.messages).filter(m => !roomIds.includes(m.room_id)));
}

// ─── Rooms ───────────────────────────────────────────────────

export function getRooms(folderId: string): Room[] {
  return load<Room>(KEYS.rooms).filter(r => r.folder_id === folderId);
}

export function addRoom(room: Room, agentIds?: string[]): void {
  const rooms = load<Room>(KEYS.rooms);
  rooms.push(room);
  save(KEYS.rooms, rooms);

  if (agentIds && agentIds.length > 0) {
    const ra = load<{ room_id: string; agent_id: string }>(KEYS.roomAgents);
    for (const agentId of agentIds) {
      ra.push({ room_id: room.id, agent_id: agentId });
    }
    save(KEYS.roomAgents, ra);
  }
}

// ─── Room ↔ Agent mapping ────────────────────────────────────

export function getRoomAgentIds(roomId: string): string[] {
  return load<{ room_id: string; agent_id: string }>(KEYS.roomAgents)
    .filter(ra => ra.room_id === roomId)
    .map(ra => ra.agent_id);
}

export function addRoomAgent(roomId: string, agentId: string): void {
  const ra = load<{ room_id: string; agent_id: string }>(KEYS.roomAgents);
  if (!ra.some(r => r.room_id === roomId && r.agent_id === agentId)) {
    ra.push({ room_id: roomId, agent_id: agentId });
    save(KEYS.roomAgents, ra);
  }
}

// ─── Agents ──────────────────────────────────────────────────

export function getAgents(folderId: string): Agent[] {
  return load<Agent>(KEYS.agents).filter(a => a.folder_id === folderId);
}

export function getAllAgents(): Agent[] {
  return load<Agent>(KEYS.agents);
}

export function getAgentById(id: string): Agent | undefined {
  return load<Agent>(KEYS.agents).find(a => a.id === id);
}

export function addAgent(agent: Agent): void {
  const agents = load<Agent>(KEYS.agents);
  agents.push(agent);
  save(KEYS.agents, agents);
}

export function removeAgent(id: string): void {
  save(KEYS.agents, load<Agent>(KEYS.agents).filter(a => a.id !== id));
  save(KEYS.roomAgents, load<{ room_id: string; agent_id: string }>(KEYS.roomAgents).filter(ra => ra.agent_id !== id));
}

export function updateAgentFolder(agentId: string, newFolderId: string): void {
  const agents = load<Agent>(KEYS.agents);
  const idx = agents.findIndex(a => a.id === agentId);
  if (idx !== -1) {
    agents[idx].folder_id = newFolderId;
    save(KEYS.agents, agents);
  }
}

// ─── Messages ────────────────────────────────────────────────

export function getMessages(roomId: string): Message[] {
  return load<Message>(KEYS.messages)
    .filter(m => m.room_id === roomId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function addMessage(message: Message): void {
  const messages = load<Message>(KEYS.messages);
  messages.push(message);
  save(KEYS.messages, messages);
}
