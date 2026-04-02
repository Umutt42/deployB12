import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SearchResult {
  type:     string;
  id:       number;
  label:    string;
  sublabel: string | null;
  route:    string;
}

@Injectable({ providedIn: 'root' })
export class GlobalSearchApi {
  private http = inject(HttpClient);

  search(q: string): Observable<SearchResult[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<SearchResult[]>(`${environment.apiUrl}/api/search`, { params });
  }
}
