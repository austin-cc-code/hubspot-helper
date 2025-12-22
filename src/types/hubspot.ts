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

// ===================================================================
// TIMELINE & ENGAGEMENT
// ===================================================================

export interface TimelineEvent {
  id: string;
  eventType: string;
  timestamp: string;
  properties: Record<string, any>;
}

export interface EngagementSummary {
  lastActivityDate?: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  formSubmissions: number;
  pageViews: number;
}

// ===================================================================
// EMAIL & MARKETING
// ===================================================================

export interface EmailEvent {
  id: string;
  eventType: 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCE' | 'UNSUBSCRIBE';
  timestamp: string;
  emailCampaignId?: string;
  recipient: string;
}

export interface MarketingStatus {
  isMarketingContact: boolean;
  status: string;
  statusUpdatedAt?: string;
}

// ===================================================================
// WORKFLOWS
// ===================================================================

export interface Workflow {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinition {
  name: string;
  type: string;
  enabled: boolean;
  actions: WorkflowAction[];
  enrollmentTriggers: WorkflowTrigger[];
}

export interface WorkflowAction {
  type: string;
  actionId?: string;
  // Flexible structure - HubSpot workflows are complex
  [key: string]: any;
}

export interface WorkflowTrigger {
  type: string;
  // Flexible structure
  [key: string]: any;
}

// ===================================================================
// ACCOUNT
// ===================================================================

export interface AccountInfo {
  portalId: number;
  accountType: string;
  timeZone: string;
  currency: string;
  utcOffset: string;
}

export interface SubscriptionInfo {
  subscriptions: HubSubscription[];
}

export interface HubSubscription {
  hub: string;
  tier: string;
  features: string[];
}
