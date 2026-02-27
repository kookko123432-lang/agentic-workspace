export interface Folder {
  id: string;
  name: string;
  description: string;
  parent_id: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  folder_id: string;
  name: string;
  type: 'meeting' | 'company' | 'direct';
  created_at: string;
}

export interface Agent {
  id: string;
  folder_id: string;
  name: string;
  role: string;
  system_instruction: string;
  is_assistant: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  agent_id: string | null;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}
