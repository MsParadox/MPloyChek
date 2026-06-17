// ============================================================
// MPloyChek  — Prisma Database Seeder
// Run: npm run db:seed
// Author: Mohit Sharma
// ============================================================
import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus, CandidateStatus, RiskLevel, Priority, RecordStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting MPloyChek v4.0 database seed...\n');

  // ── Hash passwords ──────────────────────────────────────
  const [adminHash, verifyHash, userHash] = await Promise.all([
    bcrypt.hash('Admin@123',  10),
    bcrypt.hash('Verify@123', 10),
    bcrypt.hash('User@123',   10),
  ]);

  // ── Create Users ────────────────────────────────────────
  console.log('👥 Creating users...');

  const admin = await prisma.user.upsert({
    where: { userId: 'admin001' },
    update: {},
    create: {
      userId: 'admin001', firstName: 'Meera', lastName: 'Iyer',
      email: 'meera@mploychek.com', passwordHash: adminHash,
      role: UserRole.ADMIN, department: 'Administration',
      phone: '+91-9876500001',
      joinDate: new Date('2020-01-15'), // FIX: DateTime not string
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { userId: 'john001' },
    update: {},
    create: {
      userId: 'john001', firstName: 'Aditya', lastName: 'Verma',
      email: 'aditya@mploychek.com', passwordHash: userHash,
      role: UserRole.MANAGER, department: 'Human Resources',
      phone: '+91-9876500002',
      joinDate: new Date('2023-03-20'), // FIX: DateTime
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: true,
    },
  });

  const verifier = await prisma.user.upsert({
    where: { userId: 'priya001' },
    update: {},
    create: {
      userId: 'priya001', firstName: 'Priya', lastName: 'Singh',
      email: 'priya@mploychek.com', passwordHash: verifyHash,
      role: UserRole.VERIFIER, department: 'Compliance',
      phone: '+91-9876500003',
      joinDate: new Date('2022-11-10'), // FIX: DateTime
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: false,
    },
  });

  const mohit = await prisma.user.upsert({
    where: { userId: 'mohit001' },
    update: {},
    create: {
      userId: 'mohit001', firstName: 'Mohit', lastName: 'Sharma',
      email: 'mohit@mploychek.com', passwordHash: userHash,
      role: UserRole.GENERAL_USER, department: 'Engineering',
      phone: '+91-9876500004',
      joinDate: new Date('2024-06-01'), // FIX: DateTime
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: false,
    },
  });

  const raj = await prisma.user.upsert({
    where: { userId: 'raj001' },
    update: {},
    create: {
      userId: 'raj001', firstName: 'Raj', lastName: 'Patel',
      email: 'raj@mploychek.com', passwordHash: userHash,
      role: UserRole.GENERAL_USER, department: 'Finance',
      phone: '+91-9876500005',
      joinDate: new Date('2023-08-05'), // FIX: DateTime
      status: UserStatus.ACTIVE,
    },
  });

  const anita = await prisma.user.upsert({
    where: { userId: 'anita001' },
    update: {},
    create: {
      userId: 'anita001', firstName: 'Anita', lastName: 'Desai',
      email: 'anita@mploychek.com', passwordHash: userHash,
      role: UserRole.MANAGER, department: 'Operations',
      phone: '+91-9876500006',
      joinDate: new Date('2021-04-18'), // FIX: DateTime
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: true,
    },
  });

  const kiran = await prisma.user.upsert({
    where: { userId: 'kiran001' },
    update: {},
    create: {
      userId: 'kiran001', firstName: 'Kiran', lastName: 'Kumar',
      email: 'kiran@mploychek.com', passwordHash: verifyHash,
      role: UserRole.VERIFIER, department: 'IT Security',
      phone: '+91-9876500007',
      joinDate: new Date('2022-09-12'),
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: false,
    },
  });

  const sara = await prisma.user.upsert({
    where: { userId: 'sara001' },
    update: {},
    create: {
      userId: 'sara001', firstName: 'Sara', lastName: 'Thomas',
      email: 'sara@mploychek.com', passwordHash: userHash,
      role: UserRole.GENERAL_USER, department: 'Sales',
      phone: '+91-9876500008',
      joinDate: new Date('2024-02-20'),
      status: UserStatus.ACTIVE, emailNotifications: true, smsNotifications: false,
    },
  });

  console.log('  ✅ 8 users created');

  // ── Create Candidates ────────────────────────────────────
  console.log('🎯 Creating candidates...');

  const arjun = await prisma.candidate.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      firstName: 'Arjun', lastName: 'Mehta',
      email: 'arjun.mehta@email.com', phone: '+91-9800100001',
      dateOfBirth:  new Date('1992-03-15'), // FIX: @db.Date — use Date object
      nationality: 'Indian',
      currentAddress: '123 MG Road, Bangalore 560001',
      riskScore: 15, riskLevel: RiskLevel.LOW,
      consentGiven: true, consentDate: new Date('2024-05-01'),
      notes: 'Promising candidate with clean background.',
      tags: ['engineering', 'senior', 'iit'],
      status: CandidateStatus.ACTIVE,
      assignedToId: verifier.id, createdById: manager.id,
      previousAddresses: { create: [{ address: '45 Park St, Pune 411001' }] },
      education: {
        create: [
          { institution: 'IIT Bombay', degree: 'B.Tech', field: 'Computer Science', startYear: 2010, endYear: 2014, verified: true },
          { institution: 'IIM Ahmedabad', degree: 'MBA', field: 'Finance', startYear: 2016, endYear: 2018, verified: true },
        ],
      },
      employment: {
        create: [
          {
            company: 'TCS', position: 'Software Engineer',
            startDate: new Date('2014-07-01'), // FIX: @db.Date
            endDate:   new Date('2018-06-30'), // FIX: @db.Date
            current: false, verified: true,
            contactName: 'Ramesh Rao', contactPhone: '+91-9800200001',
          },
          {
            company: 'Infosys', position: 'Senior Engineer',
            startDate: new Date('2018-08-01'), // FIX: @db.Date
            endDate: null, current: true, verified: false,
            contactName: 'Suresh Nair', contactPhone: '+91-9800200002',
          },
        ],
      },
    },
  });

  const vikram = await prisma.candidate.upsert({
    where: { id: '22222222-2222-4222-8222-222222222222' },
    update: {},
    create: {
      id: '22222222-2222-4222-8222-222222222222',
      firstName: 'Vikram', lastName: 'Nair',
      email: 'vikram.nair@email.com', phone: '+91-9800100003',
      dateOfBirth:  new Date('1988-11-30'), // FIX: @db.Date
      nationality: 'Indian',
      currentAddress: '55 Brigade Road, Bangalore 560025',
      riskScore: 58, riskLevel: RiskLevel.MEDIUM,
      consentGiven: true, consentDate: new Date('2024-05-15'),
      notes: 'Address discrepancy noted. Requires follow-up.',
      tags: ['management', 'address-issue'],
      status: CandidateStatus.FLAGGED,
      assignedToId: verifier.id, createdById: manager.id,
      education: {
        create: [{ institution: 'NIT Trichy', degree: 'B.Tech', field: 'Electrical', startYear: 2006, endYear: 2010, verified: false }],
      },
      employment: {
        create: [
          {
            company: 'Wipro', position: 'Team Lead',
            startDate: new Date('2010-08-01'), endDate: new Date('2015-07-31'), // FIX: Date objects
            current: false, verified: true,
            contactName: 'Venkat Reddy', contactPhone: '+91-9800200005',
          },
          {
            company: 'HCL', position: 'Project Manager',
            startDate: new Date('2015-09-01'), endDate: new Date('2022-12-31'), // FIX: Date objects
            current: false, verified: true,
            contactName: 'Divya Sharma', contactPhone: '+91-9800200006',
          },
        ],
      },
    },
  });

  const preethi = await prisma.candidate.upsert({
    where: { id: '33333333-3333-4333-8333-333333333333' },
    update: {},
    create: {
      id: '33333333-3333-4333-8333-333333333333',
      firstName: 'Preethi', lastName: 'Krishnan',
      email: 'preethi.k@email.com', phone: '+91-9800100005',
      dateOfBirth:  new Date('1995-07-22'), // FIX: Date
      nationality: 'Indian',
      currentAddress: '78 Koramangala, Bangalore 560034',
      riskScore: 8, riskLevel: RiskLevel.LOW,
      consentGiven: true, consentDate: new Date('2024-06-01'),
      notes: 'Excellent profile, fast-track recommended.',
      tags: ['finance', 'ca', 'clean-background'],
      status: CandidateStatus.ACTIVE,
      assignedToId: verifier.id, createdById: admin.id,
      education: {
        create: [
          { institution: 'SRCC Delhi', degree: 'B.Com', field: 'Commerce', startYear: 2013, endYear: 2016, verified: true },
          { institution: 'ICAI', degree: 'CA', field: 'Chartered Accountancy', startYear: 2016, endYear: 2019, verified: true },
        ],
      },
      employment: {
        create: [
          {
            company: 'Deloitte', position: 'Analyst',
            startDate: new Date('2019-07-01'), endDate: null, // FIX: Date
            current: true, verified: true,
            contactName: 'Arun Sharma', contactPhone: '+91-9800200009',
          },
        ],
      },
    },
  });

  const rajan = await prisma.candidate.upsert({
    where: { id: '44444444-4444-4444-8444-444444444444' },
    update: {},
    create: {
      id: '44444444-4444-4444-8444-444444444444',
      firstName: 'Rajan', lastName: 'Kumar',
      email: 'rajan.kumar@email.com', phone: '+91-9800100007',
      dateOfBirth:  new Date('1985-03-10'), // FIX: Date
      nationality: 'Indian',
      currentAddress: '201 Andheri West, Mumbai 400058',
      riskScore: 82, riskLevel: RiskLevel.HIGH,
      consentGiven: true, consentDate: new Date('2024-04-10'),
      notes: 'Employment gap of 2 years unaccounted. Criminal record check pending.',
      tags: ['high-risk', 'gap-in-employment', 'pending-criminal-check'],
      status: CandidateStatus.FLAGGED,
      assignedToId: verifier.id, createdById: manager.id,
      education: {
        create: [{ institution: 'Mumbai University', degree: 'B.Sc', field: 'Physics', startYear: 2003, endYear: 2006, verified: true }],
      },
      employment: {
        create: [
          {
            company: 'Reliance', position: 'Sales Executive',
            startDate: new Date('2007-03-01'), endDate: new Date('2012-08-31'),
            current: false, verified: true,
            contactName: 'Prem Mehta', contactPhone: '+91-9800200011',
          },
        ],
      },
    },
  });

  const neha = await prisma.candidate.upsert({
    where: { id: '55555555-5555-4555-8555-555555555555' },
    update: {},
    create: {
      id: '55555555-5555-4555-8555-555555555555',
      firstName: 'Neha', lastName: 'Gupta',
      email: 'neha.gupta@email.com', phone: '+91-9800100009',
      dateOfBirth: new Date('1994-09-08'),
      nationality: 'Indian',
      currentAddress: '12 Sector 18, Noida 201301',
      riskScore: 22, riskLevel: RiskLevel.LOW,
      consentGiven: true, consentDate: new Date('2024-05-20'),
      notes: 'Strong technical profile, references pending.',
      tags: ['engineering', 'frontend'],
      status: CandidateStatus.ACTIVE,
      assignedToId: kiran.id, createdById: anita.id,
      education: { create: [{ institution: 'Delhi Technological University', degree: 'B.Tech', field: 'Information Technology', startYear: 2012, endYear: 2016, verified: true }] },
      employment: { create: [{ company: 'Adobe', position: 'Frontend Engineer', startDate: new Date('2016-08-01'), endDate: null, current: true, verified: true, contactName: 'Manish Agarwal', contactPhone: '+91-9800200013' }] },
    },
  });

  const rohan = await prisma.candidate.upsert({
    where: { id: '66666666-6666-4666-8666-666666666666' },
    update: {},
    create: {
      id: '66666666-6666-4666-8666-666666666666',
      firstName: 'Rohan', lastName: 'Kapoor',
      email: 'rohan.kapoor@email.com', phone: '+91-9800100011',
      dateOfBirth: new Date('1990-12-25'),
      nationality: 'Indian',
      currentAddress: '88 Banjara Hills, Hyderabad 500034',
      riskScore: 35, riskLevel: RiskLevel.LOW,
      consentGiven: true, consentDate: new Date('2024-05-25'),
      notes: 'Mid-level manager, one prior employer unreachable.',
      tags: ['operations', 'manager'],
      status: CandidateStatus.ACTIVE,
      assignedToId: verifier.id, createdById: anita.id,
      education: { create: [{ institution: 'BITS Pilani', degree: 'B.E.', field: 'Mechanical', startYear: 2008, endYear: 2012, verified: true }] },
      employment: { create: [{ company: 'Amazon', position: 'Operations Manager', startDate: new Date('2014-01-01'), endDate: null, current: true, verified: false, contactName: 'Sneha Reddy', contactPhone: '+91-9800200015' }] },
    },
  });

  const amit = await prisma.candidate.upsert({
    where: { id: '77777777-7777-4777-8777-777777777777' },
    update: {},
    create: {
      id: '77777777-7777-4777-8777-777777777777',
      firstName: 'Amit', lastName: 'Shah',
      email: 'amit.shah@email.com', phone: '+91-9800100013',
      dateOfBirth: new Date('1986-06-17'),
      nationality: 'Indian',
      currentAddress: '5 CG Road, Ahmedabad 380009',
      riskScore: 72, riskLevel: RiskLevel.HIGH,
      consentGiven: true, consentDate: new Date('2024-04-28'),
      notes: 'Discrepancy in declared experience. Education unverified.',
      tags: ['high-risk', 'experience-mismatch'],
      status: CandidateStatus.FLAGGED,
      assignedToId: kiran.id, createdById: manager.id,
      education: { create: [{ institution: 'Gujarat University', degree: 'B.Com', field: 'Commerce', startYear: 2004, endYear: 2007, verified: false }] },
      employment: { create: [{ company: 'Yes Bank', position: 'Branch Manager', startDate: new Date('2009-03-01'), endDate: new Date('2020-11-30'), current: false, verified: false, contactName: 'Rakesh Jain', contactPhone: '+91-9800200017' }] },
    },
  });

  const pooja = await prisma.candidate.upsert({
    where: { id: '88888888-8888-4888-8888-888888888888' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888888',
      firstName: 'Pooja', lastName: 'Bansal',
      email: 'pooja.bansal@email.com', phone: '+91-9800100015',
      dateOfBirth: new Date('1996-01-30'),
      nationality: 'Indian',
      currentAddress: '34 Civil Lines, Jaipur 302006',
      riskScore: 18, riskLevel: RiskLevel.LOW,
      consentGiven: true, consentDate: new Date('2024-06-02'),
      notes: 'Clean profile, fresh graduate with internship experience.',
      tags: ['sales', 'fresher', 'clean-background'],
      status: CandidateStatus.ACTIVE,
      assignedToId: verifier.id, createdById: admin.id,
      education: { create: [{ institution: 'University of Rajasthan', degree: 'BBA', field: 'Marketing', startYear: 2014, endYear: 2017, verified: true }] },
      employment: { create: [{ company: 'Zomato', position: 'Sales Associate', startDate: new Date('2017-07-01'), endDate: null, current: true, verified: true, contactName: 'Deepak Sharma', contactPhone: '+91-9800200019' }] },
    },
  });

  console.log('  ✅ 8 candidates created');

  // ── Create Records ───────────────────────────────────────
  console.log('📋 Creating verification records...');

  const rec1 = await prisma.record.upsert({
    where: { id: 'rec_001' },
    update: {},
    create: {
      id: 'rec_001',
      candidateId: arjun.id, ownerId: manager.id, requestedById: manager.id,
      verifiedById: verifier.id,
      type: 'Employment Verification',
      status: RecordStatus.COMPLETED,  // FIX: Use enum
      priority: Priority.HIGH,
      submittedDate: new Date('2024-05-01'), // FIX: DateTime
      dueDate:       new Date('2024-05-10'), // FIX: DateTime
      completedDate: new Date('2024-05-08'), // FIX: DateTime
      remarks: 'All employment records verified successfully.',
      score: 92,
      billingCode: 'BIL-001',
      estimatedCost: 2500, actualCost: 2200,
      tags: ['verified', 'clean'],
      timeline: {
        create: [
          { event: 'Record Created',    description: 'Employment verification request submitted.',  performedBy: 'Aditya Verma',    status: 'Pending',   icon: 'create',   date: new Date('2024-05-01') },
          { event: 'Review Started',    description: 'Verifier Priya Singh assigned.',               performedBy: 'System',      status: 'In Review', icon: 'search',   date: new Date('2024-05-02') },
          { event: 'TCS Verified',      description: 'Employment at TCS 2014–2018 confirmed.',       performedBy: 'Priya Singh', status: 'Verification Running', icon: 'check', date: new Date('2024-05-05') },
          { event: 'Infosys Verified',  description: 'Current employment at Infosys confirmed.',     performedBy: 'Priya Singh', status: 'Verification Running', icon: 'check', date: new Date('2024-05-07') },
          { event: 'Record Completed',  description: 'All records verified. Score: 92/100.',         performedBy: 'Priya Singh', status: 'Completed', icon: 'done_all', date: new Date('2024-05-08') },
        ],
      },
    },
  });

  await prisma.record.upsert({
    where: { id: 'rec_002' },
    update: {},
    create: {
      id: 'rec_002',
      candidateId: vikram.id, ownerId: manager.id, requestedById: manager.id,
      type: 'Address Verification',
      status: RecordStatus.IN_REVIEW, // FIX: Use enum (new workflow stage)
      priority: Priority.MEDIUM,
      submittedDate: new Date('2024-05-15'),
      dueDate:       new Date('2024-05-25'),
      remarks: 'Address discrepancy — follow-up required.',
      score: null,
      billingCode: 'BIL-002',
      estimatedCost: 600,
      tags: ['address-issue', 'follow-up'],
      timeline: {
        create: [
          { event: 'Record Created', description: 'Address verification request submitted.', performedBy: 'Aditya Verma', status: 'Pending', icon: 'create', date: new Date('2024-05-15') },
          { event: 'Under Review',   description: 'Discrepancy detected — physical verification dispatched.', performedBy: 'Priya Singh', status: 'In Review', icon: 'search', date: new Date('2024-05-17') },
        ],
      },
    },
  });

  await prisma.record.upsert({
    where: { id: 'rec_003' },
    update: {},
    create: {
      id: 'rec_003',
      candidateId: preethi.id, ownerId: admin.id, requestedById: mohit.id,
      type: 'Education Verification',
      status: RecordStatus.VERIFICATION_RUNNING, // New workflow stage
      priority: Priority.HIGH,
      submittedDate: new Date('2024-06-01'),
      dueDate:       new Date('2024-06-08'),
      remarks: '',
      billingCode: 'BIL-003',
      estimatedCost: 1500,
      tags: ['education', 'ca', 'fast-track'],
      timeline: {
        create: [
          { event: 'Record Created',        description: 'Education verification submitted.', performedBy: 'Mohit Sharma', status: 'Pending', icon: 'create', date: new Date('2024-06-01') },
          { event: 'Review Started',        description: 'Assigned to compliance team.', performedBy: 'System', status: 'In Review', icon: 'search', date: new Date('2024-06-02') },
          { event: 'Verification Running',  description: 'Contacting SRCC and ICAI for degree confirmation.', performedBy: 'Priya Singh', status: 'Verification Running', icon: 'sync', date: new Date('2024-06-03') },
        ],
      },
    },
  });

  await prisma.record.upsert({
    where: { id: 'rec_004' },
    update: {},
    create: {
      id: 'rec_004',
      candidateId: rajan.id, ownerId: manager.id, requestedById: manager.id,
      type: 'Criminal Check',
      status: RecordStatus.PENDING,
      priority: Priority.CRITICAL,
      submittedDate: new Date('2024-06-05'),
      dueDate:       new Date('2024-06-12'),
      remarks: 'Employment gap 2012–2014 requires explanation.',
      billingCode: 'BIL-004',
      estimatedCost: 1000,
      tags: ['criminal-check', 'high-priority', 'gap'],
      timeline: {
        create: [
          { event: 'Record Created', description: 'Criminal background check submitted. Priority: Critical.', performedBy: 'Aditya Verma', status: 'Pending', icon: 'create', date: new Date('2024-06-05') },
        ],
      },
    },
  });

  // Additional records — span every status, score band, type & priority so the
  // dashboard KPIs, completion rate, score colours and analytics charts populate.
  const moreRecords: Array<{
    id: string; candidateId: string; ownerId: string; requestedById: string; verifiedById?: string;
    type: string; status: RecordStatus; priority: Priority;
    submitted: string; due: string; completed?: string;
    score?: number; remarks: string; estimatedCost: number; actualCost?: number; tags: string[];
    event: string; eventDesc: string; eventBy: string;
  }> = [
    { id: 'rec_005', candidateId: arjun.id,   ownerId: manager.id, requestedById: manager.id, verifiedById: verifier.id, type: 'Education Verification',  status: RecordStatus.COMPLETED, priority: Priority.HIGH,     submitted: '2024-05-02', due: '2024-05-12', completed: '2024-05-09', score: 100, remarks: 'Both degrees verified with institutions.', estimatedCost: 1500, actualCost: 1500, tags: ['verified', 'education'], event: 'Record Completed', eventDesc: 'IIT Bombay & IIM Ahmedabad confirmed. Score 100/100.', eventBy: 'Priya Singh' },
    { id: 'rec_006', candidateId: preethi.id, ownerId: admin.id,   requestedById: admin.id,   verifiedById: kiran.id,    type: 'Criminal Check',         status: RecordStatus.COMPLETED, priority: Priority.MEDIUM,   submitted: '2024-05-20', due: '2024-05-28', completed: '2024-05-26', score: 100, remarks: 'No criminal records found.', estimatedCost: 1000, actualCost: 900, tags: ['verified', 'clean'], event: 'Record Completed', eventDesc: 'Clean criminal background. Score 100/100.', eventBy: 'Kiran Kumar' },
    { id: 'rec_007', candidateId: neha.id,    ownerId: anita.id,   requestedById: anita.id,   verifiedById: kiran.id,    type: 'Credit Check',           status: RecordStatus.COMPLETED, priority: Priority.MEDIUM,   submitted: '2024-05-22', due: '2024-05-30', completed: '2024-05-29', score: 92,  remarks: 'Healthy credit history, CIBIL 780.', estimatedCost: 800, actualCost: 800, tags: ['verified', 'finance'], event: 'Record Completed', eventDesc: 'Credit score healthy. Score 92/100.', eventBy: 'Kiran Kumar' },
    { id: 'rec_008', candidateId: amit.id,    ownerId: manager.id, requestedById: manager.id, verifiedById: kiran.id,    type: 'Address Verification',   status: RecordStatus.FAILED,    priority: Priority.HIGH,     submitted: '2024-05-18', due: '2024-05-26', completed: '2024-05-27', score: 10,  remarks: 'Declared address could not be confirmed; resident unknown.', estimatedCost: 600, actualCost: 600, tags: ['failed', 'address-issue'], event: 'Verification Failed', eventDesc: 'Physical verification failed. Score 10/100.', eventBy: 'Kiran Kumar' },
    { id: 'rec_009', candidateId: rohan.id,   ownerId: anita.id,   requestedById: anita.id,   verifiedById: verifier.id, type: 'Employment Verification',status: RecordStatus.COMPLETED, priority: Priority.CRITICAL, submitted: '2024-05-10', due: '2024-05-18', completed: '2024-05-16', score: 98,  remarks: 'Current employment at Amazon confirmed.', estimatedCost: 2500, actualCost: 2400, tags: ['verified'], event: 'Record Completed', eventDesc: 'Employment confirmed. Score 98/100.', eventBy: 'Priya Singh' },
    { id: 'rec_010', candidateId: pooja.id,   ownerId: admin.id,   requestedById: mohit.id,                              type: 'Education Verification', status: RecordStatus.IN_PROGRESS, priority: Priority.LOW,    submitted: '2024-06-04', due: '2024-06-14', remarks: 'Awaiting university response.', estimatedCost: 1500, tags: ['education'], event: 'Verification Running', eventDesc: 'University of Rajasthan contacted for confirmation.', eventBy: 'Priya Singh' },
    { id: 'rec_011', candidateId: arjun.id,   ownerId: manager.id, requestedById: manager.id, verifiedById: verifier.id, type: 'Reference Check',        status: RecordStatus.APPROVED,  priority: Priority.LOW,      submitted: '2024-05-12', due: '2024-05-20', completed: '2024-05-19', score: 94,  remarks: 'Two professional references positive.', estimatedCost: 800, actualCost: 700, tags: ['approved', 'references'], event: 'Approved', eventDesc: 'References positive. Approved with score 94/100.', eventBy: 'Priya Singh' },
    { id: 'rec_012', candidateId: neha.id,    ownerId: anita.id,   requestedById: anita.id,                               type: 'Criminal Check',         status: RecordStatus.IN_PROGRESS, priority: Priority.CRITICAL, submitted: '2024-06-06', due: '2024-06-13', remarks: 'Police verification in progress.', estimatedCost: 1000, tags: ['criminal-check'], event: 'Verification Running', eventDesc: 'Police clearance requested.', eventBy: 'Kiran Kumar' },
    { id: 'rec_013', candidateId: rohan.id,   ownerId: anita.id,   requestedById: anita.id,                               type: 'Education Verification', status: RecordStatus.ON_HOLD,   priority: Priority.MEDIUM,   submitted: '2024-05-28', due: '2024-06-07', remarks: 'On hold — candidate to provide transcripts.', estimatedCost: 1500, tags: ['on-hold'], event: 'Put On Hold', eventDesc: 'Awaiting documents from candidate.', eventBy: 'Priya Singh' },
    { id: 'rec_014', candidateId: amit.id,    ownerId: manager.id, requestedById: manager.id, verifiedById: kiran.id,    type: 'Employment Verification',status: RecordStatus.REJECTED,  priority: Priority.HIGH,     submitted: '2024-05-16', due: '2024-05-24', completed: '2024-05-25', score: 28,  remarks: 'Declared tenure at Yes Bank could not be substantiated.', estimatedCost: 2500, actualCost: 2500, tags: ['rejected', 'experience-mismatch'], event: 'Rejected', eventDesc: 'Employment claims unverified. Rejected.', eventBy: 'Kiran Kumar' },
  ];

  let billNo = 5;
  for (const r of moreRecords) {
    await prisma.record.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        candidateId: r.candidateId, ownerId: r.ownerId, requestedById: r.requestedById,
        verifiedById: r.verifiedById ?? null,
        type: r.type, status: r.status, priority: r.priority,
        submittedDate: new Date(r.submitted), dueDate: new Date(r.due),
        completedDate: r.completed ? new Date(r.completed) : null,
        remarks: r.remarks, score: r.score ?? null,
        billingCode: `BIL-${String(billNo++).padStart(3, '0')}`,
        estimatedCost: r.estimatedCost, actualCost: r.actualCost ?? null,
        tags: r.tags,
        timeline: {
          create: [
            { event: 'Record Created', description: `${r.type} request submitted.`, performedBy: 'System', status: 'Pending', icon: 'create', date: new Date(r.submitted) },
            { event: r.event, description: r.eventDesc, performedBy: r.eventBy, status: r.status === RecordStatus.COMPLETED ? 'Completed' : r.status === RecordStatus.APPROVED ? 'Approved' : r.status === RecordStatus.REJECTED ? 'Rejected' : r.status === RecordStatus.FAILED ? 'Failed' : 'In Progress', icon: 'check', date: new Date(r.completed || r.due) },
          ],
        },
      },
    });
  }

  console.log('  ✅ 14 records created');

  // ── Create Notifications ─────────────────────────────────
  console.log('🔔 Creating notifications...');

  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      { userId: admin.id, title: 'System Ready', message: 'MPloyChek v4.0 database seeded successfully.', type: 'success', read: false },
      { userId: manager.id, title: 'Record Completed', message: 'Employment verification for Arjun Mehta completed with score 92/100.', type: 'success', link: '/records/rec_001', read: false },
      { userId: verifier.id, title: 'Record Assigned', message: 'Address verification for Vikram Nair requires your attention.', type: 'warning', link: '/records/rec_002', read: false },
      { userId: mohit.id, title: 'New Record Submitted', message: 'Education verification for Preethi Krishnan is now in progress.', type: 'info', link: '/records/rec_003', read: false },
      { userId: manager.id, title: 'High-Risk Flag', message: 'Criminal check for Rajan Kumar is pending — priority: Critical.', type: 'warning', link: '/records/rec_004', read: false },
    ],
  });

  console.log('  ✅ 5 notifications created');

  // ── Create Audit Logs ────────────────────────────────────
  console.log('📊 Creating audit logs...');

  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      { action: 'LOGIN',             performedById: admin.id,   performedByName: 'Meera Iyer', targetId: admin.id,   targetType: 'User',   details: 'Admin login', ipAddress: '192.168.1.1', userAgent: 'Seeder', success: true, timestamp: new Date('2024-06-01T09:00:00Z') },
      { action: 'USER_CREATED',      performedById: admin.id,   performedByName: 'Meera Iyer', targetId: verifier.id, targetType: 'User',  details: 'Created verifier account: priya001', ipAddress: '192.168.1.1', userAgent: 'Seeder', success: true, timestamp: new Date('2024-06-01T09:05:00Z') },
      { action: 'CANDIDATE_CREATED', performedById: manager.id, performedByName: 'Aditya Verma',         targetId: arjun.id,   targetType: 'Candidate', details: 'Created candidate: Arjun Mehta', ipAddress: '10.0.0.2', userAgent: 'Seeder', success: true, timestamp: new Date('2024-06-01T10:00:00Z') },
      { action: 'CREATE_RECORD',     performedById: manager.id, performedByName: 'Aditya Verma',         targetId: rec1.id,    targetType: 'Record', details: 'Employment verification request for Arjun Mehta', ipAddress: '10.0.0.2', userAgent: 'Seeder', success: true, timestamp: new Date('2024-05-01T09:00:00Z') },
      { action: 'UPDATE_RECORD',     performedById: verifier.id,performedByName: 'Priya Singh',      targetId: rec1.id,    targetType: 'Record', details: 'Status changed: Verification Running → Completed. Score: 92', ipAddress: '10.0.0.3', userAgent: 'Seeder', success: true, timestamp: new Date('2024-05-08T14:30:00Z') },
      { action: 'LOGIN_FAILED',      performedById: admin.id,   performedByName: 'Unknown',          targetId: 'auth',     targetType: 'Auth',   details: 'Failed login: unknown@test.com', ipAddress: '203.0.113.1', userAgent: 'Mozilla/5.0', success: false, timestamp: new Date('2024-06-03T22:15:00Z') },
    ],
  });

  console.log('  ✅ 6 audit log entries created');

  // ── Summary ──────────────────────────────────────────────
  console.log('\n✅ MPloyChek v4.0 seeding complete!\n');
  console.log('📌 Demo credentials:');
  console.log('   admin001  / Admin@123   → Admin');
  console.log('   john001   / User@123    → Manager');
  console.log('   priya001  / Verify@123  → Verifier');
  console.log('   mohit001  / User@123    → General User');
  console.log('\n🚀 API ready at http://localhost:3000/api');
}

main()
  .catch((e) => { console.error('❌ Seeding failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
