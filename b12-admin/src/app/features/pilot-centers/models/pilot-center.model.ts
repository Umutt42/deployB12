export interface PilotCenter {
    id?: number;
    name: string;
    cpGroup?: string | null;
    description?: string | null;
    archived: boolean;
  
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string | null;
    createdBy?: string | null;
  
    sectorIds?: number[];
    organismIds?: number[];
  }
  