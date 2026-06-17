// MPloyChek — Export Service (CSV download)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly API = `${environment.apiUrl}/export`;
  constructor(private http: HttpClient) {}

  downloadCSV(type: 'records' | 'candidates' | 'audit-logs', filename: string) {
    this.http.get(`${this.API}/${type}?format=csv`, { responseType: 'blob' }).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }

  exportJSON(type: 'records' | 'candidates'): Observable<any> {
    return this.http.get(`${this.API}/${type}?format=json`);
  }
}
