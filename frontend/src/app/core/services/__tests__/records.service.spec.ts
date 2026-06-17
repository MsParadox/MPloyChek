// MPloyChek — Records Service Tests
// Author: Mohit Sharma
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RecordsService } from '../records.service';
import { environment } from '@environments/environment';

describe('RecordsService', () => {
  let service: RecordsService;
  let httpMock: HttpTestingController;

  const mockRecords = [
    { id:'rec_1', candidateName:'Arjun Mehta', type:'Employment Verification', status:'Completed', priority:'High', score:96, ownerId:'usr_2', candidateEmail:'a@test.com', requestedById:'usr_1', requestedByName:'Admin', verifiedBy:'usr_3', verifierName:'Priya', submittedDate:'2024-01-01', dueDate:'2024-01-15', completedDate:'2024-01-10', remarks:'Verified', details:{}, timeline:[], documents:[], tags:[], billingCode:'BIL-001', estimatedCost:2500, actualCost:2400, createdAt:'2024-01-01T00:00:00Z', updatedAt:'2024-01-10T00:00:00Z' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [RecordsService] });
    service = TestBed.inject(RecordsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => expect(service).toBeTruthy());

  it('loadRecords() should fetch records and update BehaviorSubject', () => {
    const mockResp = { success:true, data: mockRecords, total:1, timestamp:new Date().toISOString(), processingTime:45 };
    service.loadRecords(0).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.data?.length).toBe(1);
      expect(service.current.length).toBe(1);
      expect(service.current[0].candidateName).toBe('Arjun Mehta');
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/records`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResp);
  });

  it('loadRecords() with delay should append delay param', () => {
    service.loadRecords(500).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/records') && r.params.has('delay'));
    expect(req.request.params.get('delay')).toBe('500');
    req.flush({ success:true, data:[], timestamp:new Date().toISOString() });
  });

  it('getById() should fetch single record', () => {
    const mockResp = { success:true, data: mockRecords[0], timestamp:new Date().toISOString() };
    service.getById('rec_1').subscribe(res => { expect(res.data?.id).toBe('rec_1'); });
    const req = httpMock.expectOne(`${environment.apiUrl}/records/rec_1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResp);
  });

  it('create() should POST and add to local state', () => {
    const payload = { candidateId:'cnd_1', type:'Criminal Check', priority:'High', dueDate:'2024-12-31' };
    const mockResp = { success:true, data:{...mockRecords[0], id:'rec_new'}, timestamp:new Date().toISOString() };
    service.create(payload).subscribe(res => { expect(res.data?.id).toBe('rec_new'); });
    const req = httpMock.expectOne(`${environment.apiUrl}/records`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResp);
  });

  it('update() should PATCH and refresh local state', () => {
    (service as any).subj.next(mockRecords);
    const mockResp = { success:true, data:{...mockRecords[0], status:'Failed'}, timestamp:new Date().toISOString() };
    service.update('rec_1', { status:'Failed' }).subscribe(() => {
      expect(service.current[0].status).toBe('Failed');
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/records/rec_1`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResp);
  });

  it('isLoading should start false', () => expect(service.isLoading).toBeFalse());
});
