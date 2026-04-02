export interface LicenseType {
    id: number;
    code: string;
    label: string;
    description: string;
    archived: boolean;
    createdAt?: string;  // ISO string
    updatedAt?: string;  // ISO string

    updatedBy?: string;

  }
  