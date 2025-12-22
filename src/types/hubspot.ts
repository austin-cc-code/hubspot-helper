/**
 * HubSpot data types
 */

export interface Contact {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface Company {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface Deal {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface PropertyDefinition {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description: string;
  options?: PropertyOption[];
}

export interface PropertyOption {
  label: string;
  value: string;
  description?: string;
  hidden: boolean;
  displayOrder: number;
}

export interface Association {
  id: string;
  type: string;
}

export interface List {
  listId: string;
  name: string;
  dynamic: boolean;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export type ObjectType = 'contact' | 'company' | 'deal';
