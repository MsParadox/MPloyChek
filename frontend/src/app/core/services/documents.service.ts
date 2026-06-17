// ============================================================
// MPloyChek v4.0 — Angular Document Service (Priority 3)
// Handles document uploads, listing, and deletion
// Author: Mohit Sharma
// ============================================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, map, filter } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Document {
  id:          string;
  candidateId: string;
  name:        string;
  type:        string;
  storageUrl:  string;
  mimeType:    string;
  sizeBytes:   number;
  uploadedBy:  string;
  uploadedAt:  string;
}

export interface UploadProgress {
  progress: number;        // 0–100
  done:     boolean;
  document?: Document;
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly base = `${environment.apiUrl}/documents`;

  constructor(private http: HttpClient) {}

  /**
   * Upload a document with real-time progress tracking
   * Uses Angular's HttpRequest for upload progress events
   */
  upload(candidateId: string, file: File, type = 'General', name?: string): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (name) formData.append('name', name);

    const req = new HttpRequest('POST', `${this.base}/upload/${candidateId}`, formData, {
      reportProgress: true,
    });

    return this.http.request(req).pipe(
      filter(event =>
        event.type === HttpEventType.UploadProgress ||
        event.type === HttpEventType.Response
      ),
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = Math.round(100 * (event.loaded / (event.total ?? event.loaded)));
          return { progress, done: false };
        }
        // Response event
        const response = event as any;
        return { progress: 100, done: true, document: response.body?.data };
      })
    );
  }

  /**
   * List all documents for a candidate
   */
  getByCandidateId(candidateId: string): Observable<Document[]> {
    return this.http.get<{ data: Document[] }>(`${this.base}/candidate/${candidateId}`)
      .pipe(map(r => r.data));
  }

  /**
   * Get a single document's metadata
   */
  getById(id: string): Observable<Document> {
    return this.http.get<{ data: Document }>(`${this.base}/${id}`)
      .pipe(map(r => r.data));
  }

  /**
   * Delete a document
   */
  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.base}/${id}`);
  }

  /**
   * Format bytes to human-readable size
   */
  formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1_048_576)   return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  /**
   * Get icon name for a document MIME type
   */
  getIcon(mimeType: string): string {
    if (mimeType === 'application/pdf')                             return 'picture_as_pdf';
    if (mimeType.startsWith('image/'))                             return 'image';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    return 'insert_drive_file';
  }
}
