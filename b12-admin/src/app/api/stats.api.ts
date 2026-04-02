import { inject, Injectable } from '@angular/core'; // v2
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MonthlyStatDto {
  year: number;
  month: number;
  count: number;
}

export interface ProvinceStatDto {
  province: string;
  count: number;
}

export interface NamedStatDto {
  name: string;
  count: number;
}

export interface StatsDto {
  // Training Centers
  trainingCentersActive: number;
  trainingCentersArchived: number;

  // Center Accreditations
  centerAccreditationsActive: number;
  centerAccreditationsArchived: number;
  centerAccreditationsExpiringIn30Days: number;
  centerAccreditationsExpiringIn60Days: number;
  caAccepted: number;
  caPending: number;
  caReceived: number;
  caRefused: number;

  // Training Accreditations
  trainingAccreditationsActive: number;
  trainingAccreditationsArchived: number;
  taAccepted: number;
  taPending: number;
  taReceived: number;
  taRefused: number;
  trainingAccreditationsExpiringIn30Days: number;
  trainingAccreditationsExpiringIn60Days: number;

  // Trainers
  trainersActive: number;
  trainersArchived: number;

  // Activities
  activitiesThisYear: number;
  activitiesTotal: number;
  activitiesLast12Months: MonthlyStatDto[];
  activitiesByProvince: ProvinceStatDto[];

  // Reference
  themesTotal: number;
  licenseTypesTotal: number;
  sectorsTotal: number;
  organismsTotal: number;
  pilotCentersTotal: number;
  subModulesActive: number;

  // Tier 1 — Analyses complémentaires
  activitiesByLicenseType: NamedStatDto[];
  activitiesByTheme: NamedStatDto[];
  topTrainers: NamedStatDto[];
  trainingAccreditationsByCenter: NamedStatDto[];

  // Tier 2 — Analyses avancées
  centerAccreditationsLast12Months: MonthlyStatDto[];
  trainingAccreditationsLast12Months: MonthlyStatDto[];
  avgProcessingDaysCa: number;
  avgProcessingDaysTa: number;
  activitiesBySector: NamedStatDto[];
}

@Injectable({ providedIn: 'root' })
export class StatsApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/stats`;

  get(): Observable<StatsDto> {
    return this.http.get<StatsDto>(this.baseUrl);
  }

  export(format: 'csv' | 'xlsx' | 'pdf'): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }
}
