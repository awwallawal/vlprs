// Target: Reference data — used by all mock files
// Wire: Sprint 2+ (all sprints reference MDA list)

export interface OyoMda {
  mdaId: string;
  mdaCode: string;
  mdaName: string;
}

export const OYO_MDAS: OyoMda[] = [
  // Ministries (26)
  { mdaId: 'mda-001', mdaCode: 'MOF', mdaName: 'Ministry of Finance' },
  { mdaId: 'mda-002', mdaCode: 'MOE', mdaName: 'Ministry of Education' },
  { mdaId: 'mda-003', mdaCode: 'MOH', mdaName: 'Ministry of Health' },
  { mdaId: 'mda-004', mdaCode: 'MOW', mdaName: 'Ministry of Works and Transport' },
  { mdaId: 'mda-005', mdaCode: 'MOA', mdaName: 'Ministry of Agriculture and Rural Development' },
  { mdaId: 'mda-006', mdaCode: 'MOJ', mdaName: 'Ministry of Justice' },
  { mdaId: 'mda-007', mdaCode: 'MTI', mdaName: 'Ministry of Trade, Industry, Investment and Cooperatives' },
  { mdaId: 'mda-008', mdaCode: 'MIC', mdaName: 'Ministry of Information, Culture and Tourism' },
  { mdaId: 'mda-009', mdaCode: 'MEN', mdaName: 'Ministry of Environment' },
  { mdaId: 'mda-010', mdaCode: 'MWA', mdaName: 'Ministry of Women Affairs, Community Development and Social Welfare' },
  { mdaId: 'mda-011', mdaCode: 'MLH', mdaName: 'Ministry of Lands, Housing and Urban Development' },
  { mdaId: 'mda-012', mdaCode: 'MLG', mdaName: 'Ministry of Local Government and Chieftaincy Affairs' },
  { mdaId: 'mda-013', mdaCode: 'MBE', mdaName: 'Ministry of Budget and Economic Planning' },
  { mdaId: 'mda-014', mdaCode: 'MET', mdaName: 'Ministry of Establishments and Training' },
  { mdaId: 'mda-015', mdaCode: 'MYS', mdaName: 'Ministry of Youth and Sports' },
  { mdaId: 'mda-016', mdaCode: 'MWR', mdaName: 'Ministry of Water Resources' },
  { mdaId: 'mda-017', mdaCode: 'MER', mdaName: 'Ministry of Energy and Mineral Resources' },
  { mdaId: 'mda-018', mdaCode: 'MST', mdaName: 'Ministry of Science and Technology' },
  { mdaId: 'mda-019', mdaCode: 'MSD', mdaName: 'Ministry of Special Duties' },
  { mdaId: 'mda-020', mdaCode: 'MHA', mdaName: 'Ministry of Home Affairs and Boundary Matters' },
  { mdaId: 'mda-021', mdaCode: 'MRE', mdaName: 'Ministry of Religious Affairs' },
  { mdaId: 'mda-022', mdaCode: 'MPE', mdaName: 'Ministry of Physical Planning and Urban Development' },
  { mdaId: 'mda-023', mdaCode: 'MCP', mdaName: 'Ministry of Community and Poverty Alleviation' },
  { mdaId: 'mda-024', mdaCode: 'MPC', mdaName: 'Ministry of Political Affairs and Inter-Governmental Relations' },
  { mdaId: 'mda-025', mdaCode: 'MDR', mdaName: 'Ministry of Diaspora and Migration' },
  { mdaId: 'mda-026', mdaCode: 'MIR', mdaName: 'Ministry of Inter-Religious Affairs' },

  // Agencies & Departments (22)
  { mdaId: 'mda-027', mdaCode: 'OHS', mdaName: 'Office of the Head of Service' },
  { mdaId: 'mda-028', mdaCode: 'BPP', mdaName: 'Bureau of Physical Planning and Development Control' },
  { mdaId: 'mda-029', mdaCode: 'IRS', mdaName: 'Oyo State Internal Revenue Service' },
  { mdaId: 'mda-030', mdaCode: 'UBE', mdaName: 'Oyo State Universal Basic Education Board' },
  { mdaId: 'mda-031', mdaCode: 'TSC', mdaName: 'Teaching Service Commission' },
  { mdaId: 'mda-032', mdaCode: 'HMB', mdaName: 'State Hospital Management Board' },
  { mdaId: 'mda-033', mdaCode: 'JSC', mdaName: 'Judicial Service Commission' },
  { mdaId: 'mda-034', mdaCode: 'CSC', mdaName: 'Civil Service Commission' },
  { mdaId: 'mda-035', mdaCode: 'LGS', mdaName: 'Local Government Service Commission' },
  { mdaId: 'mda-036', mdaCode: 'PPA', mdaName: 'Public Procurement Agency' },
  { mdaId: 'mda-037', mdaCode: 'PCR', mdaName: 'Pension Commission Review Board' },
  { mdaId: 'mda-038', mdaCode: 'SSG', mdaName: 'Office of the Secretary to the State Government' },
  { mdaId: 'mda-039', mdaCode: 'OAG', mdaName: 'Office of the Auditor General' },
  { mdaId: 'mda-040', mdaCode: 'SHA', mdaName: 'State House of Assembly Service Commission' },
  { mdaId: 'mda-041', mdaCode: 'GOV', mdaName: 'Office of the Governor' },
  { mdaId: 'mda-042', mdaCode: 'DOG', mdaName: 'Office of the Deputy Governor' },
  { mdaId: 'mda-043', mdaCode: 'OSBC', mdaName: 'Oyo State Broadcasting Corporation' },
  { mdaId: 'mda-044', mdaCode: 'WCA', mdaName: 'Water Corporation of Oyo State' },
  { mdaId: 'mda-045', mdaCode: 'RMC', mdaName: 'Road Maintenance Agency' },
  { mdaId: 'mda-046', mdaCode: 'SMA', mdaName: 'Solid Waste Management Authority' },
  { mdaId: 'mda-047', mdaCode: 'FRE', mdaName: 'Fire Service' },
  { mdaId: 'mda-048', mdaCode: 'LIB', mdaName: 'State Library Board' },

  // Parastatals & Boards (15)
  { mdaId: 'mda-049', mdaCode: 'LAUTECH', mdaName: 'Ladoke Akintola University Teaching Hospital' },
  { mdaId: 'mda-050', mdaCode: 'POLY', mdaName: 'The Polytechnic, Ibadan' },
  { mdaId: 'mda-051', mdaCode: 'COED', mdaName: 'Emmanuel Alayande College of Education' },
  { mdaId: 'mda-052', mdaCode: 'ASA', mdaName: 'Agricultural Development Programme' },
  { mdaId: 'mda-053', mdaCode: 'SWB', mdaName: 'State Sports Council' },
  { mdaId: 'mda-054', mdaCode: 'MSB', mdaName: 'Oyo State Muslim Pilgrims Welfare Board' },
  { mdaId: 'mda-055', mdaCode: 'CPB', mdaName: 'Christian Pilgrims Welfare Board' },
  { mdaId: 'mda-056', mdaCode: 'NLB', mdaName: 'Oyo State Liaison Office, Lagos' },
  { mdaId: 'mda-057', mdaCode: 'NAB', mdaName: 'Oyo State Liaison Office, Abuja' },
  { mdaId: 'mda-058', mdaCode: 'AGA', mdaName: "Accountant General's Office" },
  { mdaId: 'mda-059', mdaCode: 'DIS', mdaName: 'State Emergency Management Agency' },
  { mdaId: 'mda-060', mdaCode: 'PHC', mdaName: 'Primary Healthcare Development Board' },
  { mdaId: 'mda-061', mdaCode: 'COT', mdaName: 'College of Agriculture, Igboora' },
  { mdaId: 'mda-062', mdaCode: 'TRB', mdaName: 'Transport Authority' },
  { mdaId: 'mda-063', mdaCode: 'TVT', mdaName: 'Technical and Vocational Training Board' },
];
