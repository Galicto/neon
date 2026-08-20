/* ═══════════════════════════════════════════════════════════════
   Neo Integrations — Client Dashboard Mock Data Layer
   All data structured to match expected API response shapes.
   Swap this file's exports for real fetch() calls later.
   ═══════════════════════════════════════════════════════════════ */

const DashboardData = (() => {

  /* ── KPI Overview ─────────────────────────────────────────── */
  const MOCK_KPIS = {
    totalLeads: { today: 47, week: 312, month: 1284 },
    newLast24h: {
      total: 47,
      bySrc: [
        { source: 'WhatsApp',  count: 18, icon: 'whatsapp',  color: '#25D366' },
        { source: 'Instagram', count: 11, icon: 'instagram', color: '#E1306C' },
        { source: 'Facebook',  count: 8,  icon: 'facebook',  color: '#1877F2' },
        { source: 'Website',   count: 5,  icon: 'website',   color: '#6366F1' },
        { source: 'Email',     count: 3,  icon: 'email',     color: '#8B5CF6' },
        { source: 'Manual',    count: 2,  icon: 'manual',    color: '#64748B' },
      ]
    },
    hotLeads: 12,
    unattendedEscalations: 4,
    siteVisits: { today: 6, week: 23 },
    avgResponseTime: { seconds: 42, label: '42s', delta: -18 },
    funnel: [
      { stage: 'Leads',         count: 1284, pct: 100 },
      { stage: 'Qualified',     count: 743,  pct: 57.9 },
      { stage: 'Visit Booked',  count: 312,  pct: 24.3 },
      { stage: 'Closed',        count: 89,   pct: 6.9 },
    ],
    followUpHealth: { activeInDrip: 186, cold: 54, total: 240 },
    sparklines: {
      leadsWeekly: [32, 41, 38, 45, 52, 47, 47],
      hotWeekly: [8, 10, 14, 11, 9, 13, 12],
      visitsWeekly: [4, 7, 5, 8, 6, 5, 6],
      responseWeekly: [58, 52, 48, 44, 46, 40, 42],
    }
  };

  /* ── Leads ────────────────────────────────────────────────── */
  const STATUSES = ['New','Qualified','Hot','Visit Booked','Follow-up','Cold','Closed'];
  const SOURCES  = ['WhatsApp','Instagram','Facebook','Website','Email','Manual'];
  const REPS     = ['Arun Mehta','Priya Singh','Karan Joshi','Neha Gupta','Vikram Rao'];
  const LOCATIONS= ['Hitech City','Gachibowli','Kondapur','Banjara Hills','Jubilee Hills','Miyapur','Kukatpally','Madhapur'];
  const PROP_TYPES=['3 BHK Apartment','4 BHK Villa','2 BHK Apartment','Penthouse','Studio','3 BHK Villa','Commercial Office'];
  const BUDGETS  = ['₹50L–75L','₹75L–1Cr','₹1Cr–1.5Cr','₹1.5Cr–2Cr','₹2Cr–3Cr','₹3Cr+'];

  function _randomDate(daysBack) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
    d.setHours(Math.floor(Math.random()*24), Math.floor(Math.random()*60));
    return d;
  }
  function _fmtDate(d) {
    return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
  }
  function _fmtShortDate(d) {
    return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
  }

  const LEAD_NAMES = [
    'Rahul Sharma','Priya Reddy','Vikram Patel','Ananya Iyer','Suresh Nair',
    'Meena Gupta','Rajesh Kumar','Swati Desai','Anil Rao','Kavitha Menon',
    'Deepak Jain','Nisha Agarwal','Rohan Malhotra','Pooja Verma','Sanjay Kapoor',
    'Ritu Saxena','Manish Tiwari','Divya Bhatt','Arjun Negi','Sneha Patil',
    'Gaurav Khanna','Isha Mishra','Varun Sinha','Meghna Das','Kartik Rajan'
  ];

  const MOCK_LEADS = LEAD_NAMES.map((name, i) => {
    const captured = _randomDate(30);
    const lastContact = new Date(captured.getTime() + Math.random()*5*86400000);
    const nextFollowUp = new Date(lastContact.getTime() + (1+Math.random()*4)*86400000);
    const status = STATUSES[i % STATUSES.length];
    const score = status === 'Hot' ? 75 + Math.floor(Math.random()*25) :
                  status === 'Qualified' ? 50 + Math.floor(Math.random()*25) :
                  status === 'Cold' ? 5 + Math.floor(Math.random()*20) :
                  status === 'Closed' ? 90 + Math.floor(Math.random()*10) :
                  20 + Math.floor(Math.random()*60);
    return {
      id: `LD-${1000+i}`,
      name,
      phone: `+91 ${9000000000 + Math.floor(Math.random()*999999999)}`,
      email: name.toLowerCase().replace(' ','.')+'@email.com',
      source: SOURCES[i % SOURCES.length],
      captured: _fmtDate(captured),
      capturedRaw: captured.toISOString(),
      status,
      score,
      budget: BUDGETS[i % BUDGETS.length],
      location: LOCATIONS[i % LOCATIONS.length],
      propertyType: PROP_TYPES[i % PROP_TYPES.length],
      timeline: ['Immediate','1-3 months','3-6 months','6-12 months','Just exploring'][i%5],
      useType: i % 3 === 0 ? 'Investment' : 'Self-use',
      assignedRep: REPS[i % REPS.length],
      lastContact: _fmtDate(lastContact),
      nextFollowUp: _fmtShortDate(nextFollowUp),
      nextFollowUpRaw: nextFollowUp.toISOString(),
    };
  });

  /* ── Conversations (per lead) ─────────────────────────────── */
  const MOCK_CONVERSATIONS = {};

  // Create sample conversations for first 5 leads
  const convTemplates = [
    { channel: 'whatsapp', messages: [
      { from: 'lead', text: 'Hi, I saw your ad for the 3 BHK in Hitech City. Is it still available?', time: '10:32 AM' },
      { from: 'ira', text: 'Hello! Yes, the 3 BHK apartments in Hitech City are available. Starting at ₹85L. Are you looking for self-use or investment?', time: '10:32 AM' },
      { from: 'lead', text: 'Self use. We are a family of 4. Need good schools nearby.', time: '10:34 AM' },
      { from: 'ira', text: 'Perfect! The project is within 2km of Oakridge and Chirec schools. What\'s your preferred budget range?', time: '10:34 AM' },
      { from: 'lead', text: 'Around ₹90L to ₹1.1Cr. Can we visit this weekend?', time: '10:36 AM' },
      { from: 'ira', text: 'Absolutely! I have slots available on Saturday at 11 AM and 3 PM, and Sunday at 10 AM. Which works best for you?', time: '10:36 AM' },
      { from: 'lead', text: 'Saturday 11 AM works', time: '10:37 AM' },
      { from: 'ira', text: 'Done! ✅ Site visit booked for Saturday, 11:00 AM. Our representative Arun Mehta will meet you at the sales office. I\'ll send you the location pin and a reminder tomorrow. Is there anything else you\'d like to know?', time: '10:37 AM' },
    ]},
    { channel: 'instagram', messages: [
      { from: 'lead', text: 'Hey, what are the prices for the villas?', time: '2:15 PM' },
      { from: 'ira', text: 'Hi! Our villa prices start at ₹1.8Cr for 3 BHK and ₹2.5Cr for 4 BHK options. Would you like more details on a specific configuration?', time: '2:15 PM' },
      { from: 'lead', text: 'The 4BHK one. What\'s the carpet area?', time: '2:18 PM' },
      { from: 'ira', text: 'The 4 BHK villas offer 3,200 sq.ft. carpet area with private garden and terrace. Gated community with clubhouse, pool, and gym. Currently only 4 units remaining in Phase 2. Shall I arrange a site visit?', time: '2:18 PM' },
      { from: 'lead', text: 'Not right now, maybe next month. Send me the brochure', time: '2:20 PM' },
      { from: 'ira', text: 'Sure! I\'ve shared the brochure. I\'ll check in with you in a couple of weeks to see if you\'re ready to visit. Feel free to reach out anytime! 🏡', time: '2:20 PM' },
    ]},
    { channel: 'whatsapp', messages: [
      { from: 'lead', text: 'I want to invest in property in Gachibowli. What options do you have?', time: '8:45 PM' },
      { from: 'ira', text: 'Great choice for investment! Gachibowli is seeing 12-15% YoY appreciation. We have:\n\n• 2 BHK apartments from ₹55L\n• 3 BHK from ₹82L\n• Commercial offices from ₹45L\n\nWhat\'s your investment budget?', time: '8:45 PM' },
      { from: 'lead', text: 'Budget is around ₹1.5Cr. Looking for rental income too', time: '8:48 PM' },
      { from: 'ira', text: 'At that budget, I\'d recommend our premium 3 BHK units in Tower B — they\'re getting ₹35-40K/month rent currently, giving you ~3.2% rental yield plus appreciation. Would you like to discuss with our investment advisor?', time: '8:48 PM' },
      { from: 'lead', text: 'Yes connect me please. Also is there any discount for early booking?', time: '8:50 PM' },
      { from: 'ira', text: '🔔 I\'m connecting you with our senior advisor Karan Joshi. He\'ll reach out within the hour with exclusive pre-launch pricing details. Yes — early bookings in Tower B get a 3% discount and waived registration assistance.', time: '8:50 PM' },
    ]},
    { channel: 'email', messages: [
      { from: 'lead', text: 'Subject: Enquiry about Singapore Marina project\n\nHi,\n\nI came across your Singapore Marina project in Kondapur. Could you share the pricing and payment plan details?\n\nThanks,\nSuresh Nair', time: '11:20 AM' },
      { from: 'ira', text: 'Dear Mr. Nair,\n\nThank you for your interest in Singapore Marina! Here are the key details:\n\n• 3 BHK: ₹1.2Cr – ₹1.4Cr (1,650-1,850 sq.ft.)\n• 4 BHK: ₹1.6Cr – ₹1.9Cr (2,100-2,400 sq.ft.)\n\nPayment plan: 20% booking → 30% construction-linked → 50% on possession.\n\nPossession expected: Dec 2027.\n\nWould you like to schedule a site visit this week?\n\nBest regards,\nIra | Neo Integrations', time: '11:21 AM' },
    ]},
    { channel: 'facebook', messages: [
      { from: 'lead', text: 'Interested in the Jubilee Hills project', time: '4:10 PM' },
      { from: 'ira', text: 'Welcome! The Jubilee Hills project features ultra-luxury 4 BHK residences starting at ₹3.2Cr. Only 12 exclusive units. Are you looking for something specific in terms of size or configuration?', time: '4:10 PM' },
      { from: 'lead', text: 'Need 4bhk minimum 3000sqft', time: '4:12 PM' },
      { from: 'ira', text: 'We have two options that match:\n\n1. Unit Type A: 3,100 sq.ft, east-facing, ₹3.4Cr\n2. Unit Type B: 3,450 sq.ft, corner unit with dual views, ₹3.8Cr\n\nBoth include private elevator lobby and servant quarters. When would you like to visit?', time: '4:12 PM' },
    ]}
  ];

  MOCK_LEADS.forEach((lead, i) => {
    const tpl = convTemplates[i % convTemplates.length];
    MOCK_CONVERSATIONS[lead.id] = {
      channel: tpl.channel,
      messages: tpl.messages.map(m => ({
        ...m,
        sender: m.from === 'ira' ? 'Ira (AI)' : lead.name,
      }))
    };
  });

  /* ── Lead Detail Extras ──────────────────────────────────── */
  const MOCK_LEAD_SUMMARIES = {};
  MOCK_LEADS.forEach(lead => {
    MOCK_LEAD_SUMMARIES[lead.id] = {
      qualificationScore: lead.score,
      budget: lead.budget,
      timeline: lead.timeline,
      locationPref: lead.location,
      propertyType: lead.propertyType,
      useType: lead.useType,
      financing: ['Pre-approved loan','Cash buyer','Needs loan assistance','Exploring options'][Math.floor(Math.random()*4)],
      keyObjections: [
        ['Price is slightly above budget','Wants to compare with other projects'],
        ['Concerned about construction timeline','Needs family approval'],
        ['Looking for better rental yield','Wants furnished options'],
        ['No objections noted','Very interested'],
        ['Wants more flexible payment plan','Distance from workplace'],
      ][Math.floor(Math.random()*5)],
      aiConfidence: 60 + Math.floor(Math.random()*35),
    };
  });

  /* ── Activity Timeline ───────────────────────────────────── */
  const MOCK_ACTIVITIES = {};
  MOCK_LEADS.forEach(lead => {
    const activities = [
      { type: 'created', label: 'Lead captured', detail: `via ${lead.source}`, time: lead.captured, icon: 'plus' },
      { type: 'ai_reply', label: 'Ira responded', detail: 'First response in 42s', time: lead.captured, icon: 'bot' },
      { type: 'qualified', label: 'Lead qualified', detail: `Score: ${lead.score}/100`, time: lead.captured, icon: 'check' },
    ];
    if (lead.status === 'Visit Booked' || lead.status === 'Closed') {
      activities.push({ type: 'visit', label: 'Site visit booked', detail: `Assigned to ${lead.assignedRep}`, time: lead.lastContact, icon: 'calendar' });
    }
    if (lead.status === 'Closed') {
      activities.push({ type: 'closed', label: 'Deal closed', detail: `${lead.budget}`, time: lead.lastContact, icon: 'trophy' });
    }
    if (lead.status === 'Hot') {
      activities.push({ type: 'escalation', label: 'Escalated to human', detail: 'Lead requested callback', time: lead.lastContact, icon: 'alert' });
    }
    MOCK_ACTIVITIES[lead.id] = activities;
  });

  /* ── Escalations ─────────────────────────────────────────── */
  const MOCK_ESCALATIONS = [
    { id: 'ESC-001', leadId: 'LD-1002', leadName: 'Vikram Patel', reason: 'Requested human callback', priority: 'high', slaMinutes: 12, assignedRep: 'Karan Joshi', status: 'pending', channel: 'WhatsApp' },
    { id: 'ESC-002', leadId: 'LD-1009', leadName: 'Kavitha Menon', reason: 'Price negotiation beyond AI scope', priority: 'high', slaMinutes: 28, assignedRep: 'Priya Singh', status: 'pending', channel: 'Instagram' },
    { id: 'ESC-003', leadId: 'LD-1014', leadName: 'Pooja Verma', reason: 'Legal query about property title', priority: 'medium', slaMinutes: 45, assignedRep: 'Arun Mehta', status: 'pending', channel: 'Email' },
    { id: 'ESC-004', leadId: 'LD-1019', leadName: 'Sneha Patil', reason: 'Complaint about site visit experience', priority: 'critical', slaMinutes: 5, assignedRep: 'Vikram Rao', status: 'pending', channel: 'WhatsApp' },
  ];

  /* ── Site Visits ─────────────────────────────────────────── */
  const MOCK_VISITS = [
    { id: 'SV-001', leadName: 'Rahul Sharma', property: '3 BHK, Hitech City', date: 'Today', time: '11:00 AM', rep: 'Arun Mehta', status: 'confirmed', reminderSent: true },
    { id: 'SV-002', leadName: 'Ananya Iyer', property: '2 BHK, Gachibowli', date: 'Today', time: '2:30 PM', rep: 'Priya Singh', status: 'confirmed', reminderSent: true },
    { id: 'SV-003', leadName: 'Deepak Jain', property: 'Penthouse, Banjara Hills', date: 'Today', time: '4:00 PM', rep: 'Karan Joshi', status: 'pending', reminderSent: false },
    { id: 'SV-004', leadName: 'Rohan Malhotra', property: '4 BHK Villa, Kondapur', date: 'Tomorrow', time: '10:00 AM', rep: 'Neha Gupta', status: 'confirmed', reminderSent: true },
    { id: 'SV-005', leadName: 'Gaurav Khanna', property: '3 BHK, Jubilee Hills', date: 'Tomorrow', time: '3:00 PM', rep: 'Vikram Rao', status: 'rescheduled', reminderSent: false },
    { id: 'SV-006', leadName: 'Varun Sinha', property: 'Commercial, Madhapur', date: '28 Jul', time: '11:30 AM', rep: 'Arun Mehta', status: 'confirmed', reminderSent: false },
  ];

  /* ── Rep Performance ─────────────────────────────────────── */
  const MOCK_REPS = [
    { name: 'Arun Mehta', leadsAssigned: 68, avgResponseMin: 8, visitsBooked: 24, conversionRate: 18.2, activeEscalations: 1 },
    { name: 'Priya Singh', leadsAssigned: 72, avgResponseMin: 5, visitsBooked: 28, conversionRate: 22.1, activeEscalations: 1 },
    { name: 'Karan Joshi', leadsAssigned: 55, avgResponseMin: 12, visitsBooked: 18, conversionRate: 15.8, activeEscalations: 1 },
    { name: 'Neha Gupta', leadsAssigned: 63, avgResponseMin: 6, visitsBooked: 22, conversionRate: 20.5, activeEscalations: 0 },
    { name: 'Vikram Rao', leadsAssigned: 54, avgResponseMin: 9, visitsBooked: 19, conversionRate: 16.7, activeEscalations: 1 },
  ];

  /* ── Channel Analytics ───────────────────────────────────── */
  const MOCK_CHANNELS = [
    { source: 'WhatsApp', leads: 486, qualified: 312, hot: 48, junk: 22, costPerLead: null, color: '#25D366' },
    { source: 'Instagram', leads: 298, qualified: 165, hot: 31, junk: 45, costPerLead: 142, color: '#E1306C' },
    { source: 'Facebook', leads: 224, qualified: 118, hot: 22, junk: 38, costPerLead: 186, color: '#1877F2' },
    { source: 'Website', leads: 156, qualified: 98, hot: 18, junk: 12, costPerLead: null, color: '#6366F1' },
    { source: 'Email', leads: 78, qualified: 34, hot: 8, junk: 8, costPerLead: null, color: '#8B5CF6' },
    { source: 'Manual', leads: 42, qualified: 16, hot: 5, junk: 2, costPerLead: null, color: '#64748B' },
  ];

  /* ── Follow-up Sequences ─────────────────────────────────── */
  const MOCK_FOLLOWUPS = {
    days: Array.from({length: 14}, (_, i) => ({
      day: i + 1,
      active: Math.max(0, Math.floor(186 - i * 12 - Math.random()*8)),
      replied: Math.floor(Math.random()*15 + 5),
      stopped: Math.floor(Math.random()*4),
    })),
    approachingDay14: [
      { leadName: 'Ritu Saxena', currentDay: 13, lastReply: 'Day 8' },
      { leadName: 'Manish Tiwari', currentDay: 12, lastReply: 'Day 3' },
      { leadName: 'Divya Bhatt', currentDay: 14, lastReply: 'None' },
    ]
  };

  /* ── Daily Briefing ──────────────────────────────────────── */
  const MOCK_BRIEFING = {
    date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    newLeadsYesterday: 52,
    hotLeads: 12,
    visitScheduled: 6,
    escalationsPending: 4,
    topSource: 'WhatsApp (18 leads)',
    avgResponseTime: '42 seconds',
    notableLeads: [
      { name: 'Vikram Patel', note: '₹1.5Cr budget, wants meeting with investment advisor today' },
      { name: 'Sneha Patil', note: 'Complained about last site visit, needs personal follow-up' },
    ],
    teamHighlight: 'Priya Singh booked 5 site visits yesterday — highest this week.',
  };

  /* ── AI & NeoIntegration Health ──────────────────────────────── */
  const MOCK_AI_HEALTH = {
    apiCalls24h: 2847,
    tokenCost24h: '₹1,030',
    errorRate: 0.3,
    avgLatency: '1.2s',
    recentErrors: [
      { time: '2h ago', type: 'Timeout', detail: 'WhatsApp API timeout on message send', resolved: true },
      { time: '5h ago', type: 'Rate Limit', detail: 'Instagram API rate limit hit briefly', resolved: true },
      { time: '18h ago', type: 'Parse Error', detail: 'Failed to parse lead response (emoji-only message)', resolved: false },
    ],
    flaggedResponses: 2,
  };

  /* ── Settings / Integrations ─────────────────────────────── */
  const MOCK_INTEGRATIONS = [
    { name: 'WhatsApp Business', status: 'connected', lastSync: '2 min ago', icon: 'whatsapp' },
    { name: 'Instagram DM', status: 'connected', lastSync: '5 min ago', icon: 'instagram' },
    { name: 'Facebook Lead Ads', status: 'connected', lastSync: '12 min ago', icon: 'facebook' },
    { name: 'Email (SMTP)', status: 'connected', lastSync: '1 min ago', icon: 'email' },
    { name: 'Google Sheets', status: 'connected', lastSync: '8 min ago', icon: 'sheets' },
    { name: 'Google Calendar', status: 'warning', lastSync: '2h ago — re-auth needed', icon: 'calendar' },
    { name: 'Slack Alerts', status: 'disconnected', lastSync: 'Never', icon: 'slack' },
  ];

  /* ── Public API ──────────────────────────────────────────── */
  return {
    MOCK_KPIS,
    MOCK_LEADS,
    MOCK_CONVERSATIONS,
    MOCK_LEAD_SUMMARIES,
    MOCK_ACTIVITIES,
    MOCK_ESCALATIONS,
    MOCK_VISITS,
    MOCK_REPS,
    MOCK_CHANNELS,
    MOCK_FOLLOWUPS,
    MOCK_BRIEFING,
    MOCK_AI_HEALTH,
    MOCK_INTEGRATIONS,
    STATUSES,
    SOURCES,
    REPS,
  };

})();
