export interface Sector {
    id?: number;
    name: string;
    description?: string | null;
    archived: boolean;
  
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string | null;
    createdBy?: string | null;
  
    organismIds?: number[];
    pilotCenterIds?: number[];
  }
  