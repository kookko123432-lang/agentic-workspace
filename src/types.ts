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

export interface WorkspaceFile {
  id: string;
  folder_id: string;
  name: string;
  type: string;       // MIME type
  size: number;       // bytes
  content: string;    // extracted text content (for AI reading)
  created_at: string;
}
