export interface Organism {
    id?: number;
    name: string;
    abbreviation?: string | null;
    archived: boolean;
  
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string | null;
    createdBy?: string | null;
  
    sectorIds?: number[];
    pilotCenterIds?: number[];
  }
  