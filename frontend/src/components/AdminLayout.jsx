import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Dashboard Data States
  const [contacts, setContacts] = useState([]);
  const [parentSignups, setParentSignups] = useState([]);
  const [tutorSignups, setTutorSignups] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [tutors, setTutors] = useState([]);
  
  // Modal & Edit States
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(''); // 'view-parent' | 'view-tutor' | 'view-contact' | 'add-tutor' | 'edit-tutor'
  const [tutorFormData, setTutorFormData] = useState({ name: '', subject: '', qualification: '', experience: '', rating: '5.0', board: 'CBSE & ICSE', image: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');

  useEffect(() => {
    document.title = 'Admin Dashboard | DHIYONI Tutorials';
    
    // 1. Authenticate Guard
    const token = localStorage.getItem('dhiyoni_admin_token');
    const localUser = localStorage.getItem('dhiyoni_admin_user');
    
    if (!token || !localUser) {
      handleLogout();
      return;
    }

    setUser(JSON.parse(localUser));

    // Verify token validity with backend
    fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) throw new Error('Session expired');
      return res.json();
    })
    .then(data => {
      setLoading(false);
      // Fetch initial data
      fetchAllData();
    })
    .catch(err => {
      console.error(err);
      handleLogout();
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('dhiyoni_admin_token');
    localStorage.removeItem('dhiyoni_admin_user');
    navigate('/admin/login');
  };

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('dhiyoni_admin_token')}`,
    'Content-Type': 'application/json'
  });

  const fetchAllData = async () => {
    try {
      const headers = getHeaders();
      
      const [resContacts, resParents, resTutorsSignup, resNews, resTutors] = await Promise.all([
        fetch('/api/contacts', { headers }),
        fetch('/api/parent-signups', { headers }),
        fetch('/api/tutor-signups', { headers }),
        fetch('/api/newsletters', { headers }),
        fetch('/api/tutors') // Public API
      ]);

      if (resContacts.ok) setContacts(await resContacts.json());
      if (resParents.ok) setParentSignups(await resParents.json());
      if (resTutorsSignup.ok) setTutorSignups(await resTutorsSignup.json());
      if (resNews.ok) setNewsletters(await resNews.json());
      if (resTutors.ok) setTutors(await resTutors.json());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  // Submission Status Updates
  const updateStatus = async (type, id, status) => {
    try {
      const urlMap = {
        parent: `/api/parent-signups/${id}`,
        tutor: `/api/tutor-signups/${id}`,
        contact: `/api/contacts/${id}`
      };
      
      const response = await fetch(urlMap[type], {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        // Refresh local data
        fetchAllData();
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem(prev => ({ ...prev, status }));
        }
      }
    } catch (err) {
      console.error(`Failed to update status for ${type}:`, err);
    }
  };

  // Submission Deletion
  const deleteItem = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} record?`)) return;
    
    try {
      const urlMap = {
        parent: `/api/parent-signups/${id}`,
        tutor: `/api/tutor-signups/${id}`,
        contact: `/api/contacts/${id}`,
        newsletter: `/api/newsletters/${id}`,
        tutorProfile: `/api/tutors/${id}`
      };

      const response = await fetch(urlMap[type], {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (response.ok) {
        fetchAllData();
        setSelectedItem(null);
        setModalType('');
      } else {
        alert('Failed to delete item.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Tutor CRUD Operations
  const handleTutorSubmit = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });

    const isEdit = modalType === 'edit-tutor';
    const url = isEdit ? `/api/tutors/${selectedItem._id}` : '/api/tutors';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(tutorFormData)
      });

      if (response.ok) {
        setFormMsg({ type: 'success', text: `Tutor profile ${isEdit ? 'updated' : 'created'} successfully!` });
        setTutorFormData({ name: '', subject: '', qualification: '', experience: '', rating: '5.0', board: 'CBSE & ICSE', image: '' });
        fetchAllData();
        setTimeout(() => {
          setModalType('');
          setSelectedItem(null);
          setFormMsg({ type: '', text: '' });
        }, 1500);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Operation failed');
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: err.message });
    }
  };

  const openAddTutor = () => {
    setTutorFormData({ name: '', subject: '', qualification: '', experience: '', rating: '5.0', board: 'CBSE & ICSE', image: '' });
    setSelectedItem(null);
    setModalType('add-tutor');
  };

  const openEditTutor = (tutorItem) => {
    setTutorFormData({
      name: tutorItem.name,
      subject: tutorItem.subject,
      qualification: tutorItem.qualification,
      experience: tutorItem.experience,
      rating: tutorItem.rating,
      board: tutorItem.board,
      image: tutorItem.image
    });
    setSelectedItem(tutorItem);
    setModalType('edit-tutor');
  };

  // Change Password
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFormMsg({ type: 'error', text: 'New passwords do not match!' });
      return;
    }

    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFormMsg({ type: 'success', text: 'Password changed successfully!' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        throw new Error(data.message || 'Failed to change password');
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-montserrat font-bold text-primary">Loading DHIYONI Admin Portal...</p>
        </div>
      </div>
    );
  }

  // Helpers
  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Enrolled':
      case 'Approved':
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Contacted':
      case 'Interview Scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] flex font-inter text-on-surface">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside 
        className={`bg-[#002f3d] text-white shrink-0 flex flex-col justify-between transition-all duration-300 relative z-30 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div>
          {/* Logo Brand Area */}
          <div className="h-20 flex items-center gap-3 px-6 border-b border-white/10 overflow-hidden">
            <span className="material-symbols-outlined text-[32px] text-accent-orange shrink-0">school</span>
            {sidebarOpen && (
              <span className="font-montserrat font-bold text-lg whitespace-nowrap">DHIYONI Panel</span>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: 'dashboard' },
              { id: 'parentSignups', label: 'Parent Requests', icon: 'person_search', badge: parentSignups.filter(x=>x.status==='Pending').length },
              { id: 'tutorSignups', label: 'Tutor Applications', icon: 'contact_page', badge: tutorSignups.filter(x=>x.status==='Pending').length },
              { id: 'contacts', label: 'Inquiries', icon: 'mail', badge: contacts.filter(x=>x.status==='Pending').length },
              { id: 'newsletters', label: 'Newsletter Subscribers', icon: 'campaign' },
              { id: 'tutorsCrud', label: 'Manage Tutors', icon: 'groups' },
              { id: 'settings', label: 'Security Settings', icon: 'settings' }
            ].map(({ id, label, icon, badge }) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setSearchQuery(''); setStatusFilter('all'); setGradeFilter('all'); }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  activeTab === id 
                    ? 'bg-accent-orange text-white shadow-md font-bold' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
                title={label}
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[22px] shrink-0">{icon}</span>
                  {sidebarOpen && <span className="text-body-sm whitespace-nowrap">{label}</span>}
                </div>
                {sidebarOpen && badge > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-white/60 hover:bg-rose-950/20 hover:text-rose-400 transition-all font-semibold"
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">logout</span>
            {sidebarOpen && <span className="text-body-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-x-hidden min-h-screen">
        {/* Top Header Bar */}
        <header className="h-20 bg-white border-b border-outline-variant/30 flex items-center justify-between px-8 shrink-0 relative z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded-lg hover:bg-surface-container transition-colors text-primary"
              aria-label="Toggle sidebar"
            >
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>
            <h1 className="font-montserrat font-bold text-xl text-primary capitalize hidden md:block">
              {activeTab === 'tutorsCrud' ? 'Tutor Listings Manager' : activeTab.replace(/([A-Z])/g, ' $1')}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right hidden sm:block">
              <span className="font-montserrat text-label-md font-bold text-primary">{user?.username}</span>
              <span className="font-inter text-xs text-on-surface-variant">{user?.email}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold font-montserrat shadow-sm border border-outline-variant/30">
              {user?.username.charAt(0)}
            </div>
          </div>
        </header>

        {/* Inner Scrollable Workspace */}
        <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-container-max w-full mx-auto">
          {/* TAB 1: OVERVIEW SCREEN */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Parent Signups', count: parentSignups.length, pending: parentSignups.filter(x=>x.status==='Pending').length, icon: 'person_search', color: 'bg-blue-500' },
                  { label: 'Tutor Applications', count: tutorSignups.length, pending: tutorSignups.filter(x=>x.status==='Pending').length, icon: 'contact_page', color: 'bg-amber-500' },
                  { label: 'General Inquiries', count: contacts.length, pending: contacts.filter(x=>x.status==='Pending').length, icon: 'mail', color: 'bg-emerald-500' },
                  { label: 'Newsletter List', count: newsletters.length, pending: 0, icon: 'campaign', color: 'bg-purple-500' }
                ].map(({ label, count, pending, icon, color }) => (
                  <div key={label} className="bg-white p-6 rounded-2xl border border-outline-variant/30 teal-shadow flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="font-montserrat text-label-md text-on-surface-variant uppercase tracking-wider font-bold">{label}</p>
                      <h3 className="font-montserrat text-3xl font-bold text-primary">{count}</h3>
                      {pending > 0 && (
                        <p className="text-xs text-amber-600 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          {pending} pending reviews
                        </p>
                      )}
                    </div>
                    <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg shadow-black/5`}>
                      <span className="material-symbols-outlined text-[28px]">{icon}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Activity List */}
              <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6">
                <h3 className="font-montserrat font-bold text-lg text-primary mb-6">Recent Form Submissions</h3>
                
                {parentSignups.length === 0 && tutorSignups.length === 0 && contacts.length === 0 ? (
                  <div className="text-center py-10 text-on-surface-variant font-medium">
                    No submissions recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant/20 max-h-[400px] overflow-y-auto pr-2">
                    {[
                      ...parentSignups.map(x => ({ ...x, type: 'parent' })),
                      ...tutorSignups.map(x => ({ ...x, type: 'tutor' })),
                      ...contacts.map(x => ({ ...x, type: 'contact' }))
                    ]
                      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .slice(0, 10)
                      .map((item, idx) => (
                        <div key={item._id} className="py-4 flex items-center justify-between flex-wrap gap-2 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              item.type === 'parent' ? 'bg-blue-100 text-blue-700' :
                              item.type === 'tutor' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              <span className="material-symbols-outlined text-[20px]">
                                {item.type === 'parent' ? 'person_search' : item.type === 'tutor' ? 'contact_page' : 'mail'}
                              </span>
                            </div>
                            <div>
                              <p className="font-inter font-bold text-body-sm">
                                {item.type === 'parent' ? `${item.studentName} (Parent: ${item.parentName})` :
                                 item.type === 'tutor' ? item.fullName : item.name}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                {item.type === 'parent' ? 'Student Enrollment' :
                                 item.type === 'tutor' ? 'Tutor Application' : `Contact Inquiry: ${item.subject}`}
                                 <span className="mx-2">•</span>{formatTime(item.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setModalType(`view-${item.type}`);
                              }}
                              className="text-primary hover:text-accent-orange font-bold text-xs hover:underline flex items-center gap-1"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STUDENT / PARENT SIGNUP REQUESTS */}
          {activeTab === 'parentSignups' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              {/* Search & Filter Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                  <input
                    type="text"
                    placeholder="Search by student or parent name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Enrolled">Enrolled</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead className="bg-slate-50 text-primary font-montserrat font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="p-4">Submission Date</th>
                      <th className="p-4">Student</th>
                      <th className="p-4">Grade / Subject</th>
                      <th className="p-4">Parent Name</th>
                      <th className="p-4">Contact Detail</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {parentSignups
                      .filter(x => {
                        const nameMatch = x.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                          x.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                          x.email.toLowerCase().includes(searchQuery.toLowerCase());
                        const statusMatch = statusFilter === 'all' || x.status === statusFilter;
                        return nameMatch && statusMatch;
                      })
                      .map(item => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 whitespace-nowrap text-on-surface-variant font-medium">{formatTime(item.createdAt)}</td>
                          <td className="p-4 font-bold">{item.studentName}</td>
                          <td className="p-4 font-medium">{item.grade} <span className="text-on-surface-variant text-[11px]">• {item.subject}</span></td>
                          <td className="p-4 font-medium">{item.parentName}</td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-bold">{item.contact}</span>
                              <span className="text-xs text-on-surface-variant">{item.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <select
                              value={item.status}
                              onChange={(e) => updateStatus('parent', item._id, e.target.value)}
                              className={`px-2.5 py-1 rounded-full border text-[11px] font-bold outline-none cursor-pointer appearance-none text-center ${getStatusClass(item.status)}`}
                              style={{ textAlignLast: 'center' }}
                            >
                              <option value="Pending" className="text-amber-800 bg-white">Pending</option>
                              <option value="Contacted" className="text-blue-800 bg-white">Contacted</option>
                              <option value="Enrolled" className="text-emerald-800 bg-white">Enrolled</option>
                              <option value="Rejected" className="text-rose-800 bg-white">Rejected</option>
                            </select>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => { setSelectedItem(item); setModalType('view-parent'); }}
                              className="text-primary hover:text-accent-orange font-bold hover:underline"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => deleteItem('parent', item._id)}
                              className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    {parentSignups.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-on-surface-variant font-medium">No signup requests found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TUTOR APPLICATIONS */}
          {activeTab === 'tutorSignups' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              {/* Search Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                  <input
                    type="text"
                    placeholder="Search by tutor name or email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead className="bg-slate-50 text-primary font-montserrat font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="p-4">Submission Date</th>
                      <th className="p-4">Applicant</th>
                      <th className="p-4">Qualification</th>
                      <th className="p-4">Subjects & Grades</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {tutorSignups
                      .filter(x => {
                        const nameMatch = x.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                          x.email.toLowerCase().includes(searchQuery.toLowerCase());
                        const statusMatch = statusFilter === 'all' || x.status === statusFilter;
                        return nameMatch && statusMatch;
                      })
                      .map(item => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 whitespace-nowrap text-on-surface-variant font-medium">{formatTime(item.createdAt)}</td>
                          <td className="p-4 font-bold">
                            <div className="flex flex-col">
                              <span>{item.fullName}</span>
                              <span className="text-[11px] font-normal text-on-surface-variant">{item.contact}</span>
                            </div>
                          </td>
                          <td className="p-4 font-medium">{item.qualification} <span className="text-on-surface-variant text-[11px]">• {item.occupation}</span></td>
                          <td className="p-4 font-medium">
                            <div className="flex flex-col">
                              <span>{item.subjects}</span>
                              <span className="text-xs text-on-surface-variant">{item.grades}</span>
                            </div>
                          </td>
                          <td className="p-4 text-on-surface-variant">{item.location}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => { setSelectedItem(item); setModalType('view-tutor'); }}
                              className="text-primary hover:text-accent-orange font-bold hover:underline"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => deleteItem('tutor', item._id)}
                              className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    {tutorSignups.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-on-surface-variant font-medium">No applications found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CONTACT INQUIRIES */}
          {activeTab === 'contacts' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              {/* Search Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                  <input
                    type="text"
                    placeholder="Search by name, email or message content..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Inquiries</option>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead className="bg-slate-50 text-primary font-montserrat font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="p-4">Submission Date</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4">Message Snippet</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {contacts
                      .filter(x => {
                        const match = x.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      x.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      x.message.toLowerCase().includes(searchQuery.toLowerCase());
                        const statusMatch = statusFilter === 'all' || x.status === statusFilter;
                        return match && statusMatch;
                      })
                      .map(item => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 whitespace-nowrap text-on-surface-variant font-medium">{formatTime(item.createdAt)}</td>
                          <td className="p-4 font-bold">{item.name}</td>
                          <td className="p-4 font-medium text-primary hover:underline"><a href={`mailto:${item.email}`}>{item.email}</a></td>
                          <td className="p-4 font-semibold text-accent-orange">{item.subject}</td>
                          <td className="p-4 text-on-surface-variant truncate max-w-xs">{item.message}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getStatusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => { setSelectedItem(item); setModalType('view-contact'); }}
                              className="text-primary hover:text-accent-orange font-bold hover:underline"
                            >
                              Read
                            </button>
                            <button
                              onClick={() => deleteItem('contact', item._id)}
                              className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    {contacts.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-on-surface-variant font-medium">No inquiries found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: NEWSLETTER LIST */}
          {activeTab === 'newsletters' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in max-w-xl mx-auto">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                <h3 className="font-montserrat font-bold text-lg text-primary">Newsletter Subscriptions</h3>
                <span className="bg-primary-fixed text-primary text-xs font-bold px-3 py-1 rounded-full">{newsletters.length} Subscribed</span>
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead className="bg-slate-50 text-primary font-montserrat font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="p-4">Email ID</th>
                      <th className="p-4">Joined Date</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {newsletters
                      .filter(x => x.email.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(item => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-primary">{item.email}</td>
                          <td className="p-4 text-on-surface-variant">{new Date(item.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => deleteItem('newsletter', item._id)}
                              className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    {newsletters.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center py-10 text-on-surface-variant font-medium">No subscribers registered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: TUTOR CONTENT CRUD */}
          {activeTab === 'tutorsCrud' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
                <div>
                  <h3 className="font-montserrat font-bold text-lg text-primary">Tutors Profiles</h3>
                  <p className="font-inter text-xs text-on-surface-variant">These profiles display dynamically on the public Tutors directory.</p>
                </div>
                <button
                  onClick={openAddTutor}
                  className="bg-primary text-white font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-primary-container active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 self-start"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add New Tutor</span>
                </button>
              </div>

              {/* Tutors Database List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tutors.map(tutor => (
                  <div key={tutor._id} className="bg-slate-50 border border-outline-variant/35 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group">
                    <div className="p-5 space-y-4">
                      {/* Tutor card header */}
                      <div className="flex gap-4 items-center">
                        <img 
                          src={tutor.image || 'https://via.placeholder.com/150'} 
                          alt={tutor.name} 
                          className="w-16 h-16 rounded-full object-cover border border-outline-variant shrink-0"
                        />
                        <div>
                          <h4 className="font-montserrat font-bold text-primary">{tutor.name}</h4>
                          <span className="bg-tertiary-fixed text-primary px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-0.5">{tutor.subject}</span>
                        </div>
                      </div>

                      {/* Details specs */}
                      <div className="text-body-sm space-y-1.5 border-t border-b border-outline-variant/20 py-3 text-on-surface-variant font-medium">
                        <p className="flex justify-between"><span>Board:</span> <span className="font-bold text-primary">{tutor.board}</span></p>
                        <p className="flex justify-between"><span>Qual:</span> <span className="font-bold">{tutor.qualification}</span></p>
                        <p className="flex justify-between"><span>Experience:</span> <span className="font-bold">{tutor.experience}</span></p>
                        <p className="flex justify-between"><span>Rating:</span> <span className="font-bold text-accent-orange flex items-center gap-0.5">★ {tutor.rating}</span></p>
                      </div>
                    </div>

                    {/* Actions button */}
                    <div className="bg-slate-100/50 p-4 border-t border-outline-variant/15 flex justify-end gap-3">
                      <button
                        onClick={() => openEditTutor(tutor)}
                        className="text-primary hover:text-accent-orange font-bold text-xs flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                      </button>
                      <button
                        onClick={() => deleteItem('tutorProfile', tutor._id)}
                        className="text-rose-600 hover:text-rose-800 font-bold text-xs flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: SECURITY SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-md bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in mx-auto">
              <div className="border-b border-outline-variant/20 pb-4">
                <h3 className="font-montserrat font-bold text-lg text-primary">Change Password</h3>
                <p className="font-inter text-xs text-on-surface-variant">Update the login password for your administrator profile.</p>
              </div>

              {formMsg.text && (
                <div className={`p-4 border rounded-xl text-body-sm flex items-start gap-2 ${
                  formMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <span className="material-symbols-outlined shrink-0 text-[20px]">
                    {formMsg.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <span>{formMsg.text}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-xs">
                  <label className="font-inter text-body-sm font-bold text-on-surface block">Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-inter text-body-sm font-bold text-on-surface block">New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-inter text-body-sm font-bold text-on-surface block">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-white py-3.5 px-4 rounded-xl font-montserrat font-bold text-body-md hover:bg-primary-container active:scale-95 transition-all shadow-md"
                >
                  Update password
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ── DETAIL & CRUD MODALS ──────────────────────────────── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-outline-variant max-w-2xl w-full p-6 md:p-8 relative shadow-2xl space-y-6 my-8 animate-fade-in-up">
            {/* Close Button */}
            <button
              onClick={() => { setSelectedItem(null); setModalType(''); setFormMsg({ type: '', text: '' }); }}
              className="absolute top-5 right-5 text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-full hover:bg-surface-container"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>

            {/* MODAL SUB-VIEWS: VIEW CONTACT */}
            {modalType === 'view-contact' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">General Inquiry</span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.subject}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted on {formatTime(selectedItem.createdAt)}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-body-sm font-medium">
                  <p><span className="text-on-surface-variant">Contact Name:</span> <br/><span className="font-bold text-base text-primary">{selectedItem.name}</span></p>
                  <p><span className="text-on-surface-variant">Email Address:</span> <br/><span className="font-bold text-base text-primary hover:underline"><a href={`mailto:${selectedItem.email}`}>{selectedItem.email}</a></span></p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-montserrat font-semibold text-body-sm text-primary">Inquiry Message:</h4>
                  <div className="bg-slate-50 p-4 rounded-xl font-inter text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line border border-outline-variant/20">
                    {selectedItem.message}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-6">
                  <div className="flex items-center gap-3">
                    <span className="font-montserrat text-xs font-bold text-primary">Status:</span>
                    <select
                      value={selectedItem.status}
                      onChange={(e) => updateStatus('contact', selectedItem._id, e.target.value)}
                      className="bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                  <button
                    onClick={() => deleteItem('contact', selectedItem._id)}
                    className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Delete Submission
                  </button>
                </div>
              </div>
            )}

            {/* MODAL SUB-VIEWS: VIEW PARENT SIGNUP */}
            {modalType === 'view-parent' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">Student Signup Request</span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.studentName}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted on {formatTime(selectedItem.createdAt)}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                    <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Student details</h4>
                    <p><span className="text-on-surface-variant">Name:</span> <span className="float-right font-bold">{selectedItem.studentName}</span></p>
                    <p><span className="text-on-surface-variant">Gender:</span> <span className="float-right font-bold capitalize">{selectedItem.gender}</span></p>
                    <p><span className="text-on-surface-variant">Grade/Class:</span> <span className="float-right font-bold">{selectedItem.grade}</span></p>
                    <p><span className="text-on-surface-variant">Subject needed:</span> <span className="float-right font-bold text-accent-orange">{selectedItem.subject}</span></p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                    <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Parent & Location</h4>
                    <p><span className="text-on-surface-variant">Parent Name:</span> <span className="float-right font-bold">{selectedItem.parentName}</span></p>
                    <p><span className="text-on-surface-variant">Contact No:</span> <span className="float-right font-bold text-primary"><a href={`tel:${selectedItem.contact}`}>{selectedItem.contact}</a></span></p>
                    <p><span className="text-on-surface-variant">Email Address:</span> <span className="float-right font-bold text-primary"><a href={`mailto:${selectedItem.email}`}>{selectedItem.email}</a></span></p>
                    <p><span className="text-on-surface-variant">Location:</span> <span className="float-right font-bold">{selectedItem.city}, {selectedItem.state}</span></p>
                  </div>
                </div>

                <div className="bg-[#f0f5fa] p-4 rounded-xl text-body-sm font-medium">
                  <p><span className="text-on-surface-variant">How they heard about DHIYONI:</span> <span className="font-bold text-primary ml-2 capitalize">{selectedItem.referral.replace('_', ' ') || 'None'}</span></p>
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-6">
                  <div className="flex items-center gap-3">
                    <span className="font-montserrat text-xs font-bold text-primary">Status:</span>
                    <select
                      value={selectedItem.status}
                      onChange={(e) => updateStatus('parent', selectedItem._id, e.target.value)}
                      className="bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Enrolled">Enrolled</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  <button
                    onClick={() => deleteItem('parent', selectedItem._id)}
                    className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Delete Submission
                  </button>
                </div>
              </div>
            )}

            {/* MODAL SUB-VIEWS: VIEW TUTOR SIGNUP */}
            {modalType === 'view-tutor' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">Tutor application</span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.fullName}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted on {formatTime(selectedItem.createdAt)}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                    <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Personal Details</h4>
                    <p><span className="text-on-surface-variant">Gender:</span> <span className="float-right font-bold capitalize">{selectedItem.gender}</span></p>
                    <p><span className="text-on-surface-variant">D.O.B:</span> <span className="float-right font-bold">{new Date(selectedItem.dob).toLocaleDateString('en-IN')}</span></p>
                    <p><span className="text-on-surface-variant">Location:</span> <span className="float-right font-bold truncate max-w-[150px]">{selectedItem.location}</span></p>
                    <p><span className="text-on-surface-variant">Contact:</span> <span className="float-right font-bold text-primary"><a href={`tel:${selectedItem.contact}`}>{selectedItem.contact}</a></span></p>
                    <p><span className="text-on-surface-variant">Email:</span> <span className="float-right font-bold text-primary hover:underline truncate max-w-[150px]"><a href={`mailto:${selectedItem.email}`}>{selectedItem.email}</a></span></p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                    <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Academic & Experience</h4>
                    <p><span className="text-on-surface-variant">Highest Degree:</span> <span className="float-right font-bold">{selectedItem.qualification}</span></p>
                    <p><span className="text-on-surface-variant">Occupation:</span> <span className="float-right font-bold capitalize">{selectedItem.occupation}</span></p>
                    <p><span className="text-on-surface-variant">Classes can teach:</span> <span className="float-right font-bold">{selectedItem.grades}</span></p>
                    <p><span className="text-on-surface-variant">Subjects handle:</span> <span className="float-right font-bold text-accent-orange">{selectedItem.subjects}</span></p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl text-body-sm space-y-2 font-medium">
                  <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Logistics & Availability</h4>
                  <p><span className="text-on-surface-variant">Preferred time:</span> <span className="font-bold float-right">{selectedItem.time}</span></p>
                  <p><span className="text-on-surface-variant">Boards preference:</span> <span className="font-bold float-right uppercase">{selectedItem.boards.join(', ') || 'None'}</span></p>
                  <p><span className="text-on-surface-variant">Tech access (Laptop+Internet):</span> <span className="font-bold float-right">{selectedItem.hasTech ? 'Yes' : 'No'}</span></p>
                </div>

                {selectedItem.experience && (
                  <div className="space-y-2">
                    <h4 className="font-montserrat font-semibold text-body-sm text-primary">Teaching Experience Profile:</h4>
                    <div className="bg-slate-50 p-4 rounded-xl font-inter text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line border border-outline-variant/20">
                      {selectedItem.experience}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-6">
                  <div className="flex items-center gap-3">
                    <span className="font-montserrat text-xs font-bold text-primary">Status:</span>
                    <select
                      value={selectedItem.status}
                      onChange={(e) => updateStatus('tutor', selectedItem._id, e.target.value)}
                      className="bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Interview Scheduled">Interview Scheduled</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  <button
                    onClick={() => deleteItem('tutor', selectedItem._id)}
                    className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Delete Submission
                  </button>
                </div>
              </div>
            )}

            {/* MODAL SUB-VIEWS: ADD / EDIT TUTOR */}
            {(modalType === 'add-tutor' || modalType === 'edit-tutor') && (
              <div className="space-y-4">
                <div className="border-b border-outline-variant/20 pb-4">
                  <h3 className="font-montserrat font-bold text-2xl text-primary">
                    {modalType === 'add-tutor' ? 'Add New Tutor Profile' : 'Edit Tutor Profile'}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1">This registers a profile visible in the dynamic Tutors listing</p>
                </div>

                {formMsg.text && (
                  <div className={`p-4 border rounded-xl text-body-sm flex items-start gap-2 ${
                    formMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <span className="material-symbols-outlined shrink-0 text-[20px]">
                      {formMsg.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <span>{formMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleTutorSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Tutor Name</label>
                    <input
                      type="text"
                      required
                      value={tutorFormData.name}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, name: e.target.value })}
                      placeholder="Dr. Anita Sharma"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Subject Specialization</label>
                    <input
                      type="text"
                      required
                      value={tutorFormData.subject}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, subject: e.target.value })}
                      placeholder="Mathematics"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Academic Qualifications</label>
                    <input
                      type="text"
                      required
                      value={tutorFormData.qualification}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, qualification: e.target.value })}
                      placeholder="M.Sc, Ph.D in Maths"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Years of Experience</label>
                    <input
                      type="text"
                      required
                      value={tutorFormData.experience}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, experience: e.target.value })}
                      placeholder="12+ Years"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Boards Expertise</label>
                    <input
                      type="text"
                      required
                      value={tutorFormData.board}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, board: e.target.value })}
                      placeholder="CBSE & ICSE"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Public Rating</label>
                    <input
                      type="text"
                      required
                      value={tutorFormData.rating}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, rating: e.target.value })}
                      placeholder="4.9"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-xs">
                    <label className="font-inter text-body-sm font-bold text-on-surface block">Tutor Image URL</label>
                    <input
                      type="url"
                      required
                      value={tutorFormData.image}
                      onChange={(e) => setTutorFormData({ ...tutorFormData, image: e.target.value })}
                      placeholder="https://lh3.googleusercontent.com/..."
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-4 flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-white font-montserrat font-bold py-3.5 px-4 rounded-xl hover:bg-primary-container active:scale-95 transition-all shadow-md"
                    >
                      {modalType === 'add-tutor' ? 'Create Profile' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedItem(null); setModalType(''); }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 border border-outline-variant/30 text-primary font-montserrat font-bold py-3.5 px-4 rounded-xl active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
