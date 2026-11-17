import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ExportModal from './ExportModal';
import ExportStatusTracker from './ExportStatusTracker';
import ExportHistoryTab from './ExportHistoryTab';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user] = useState(() => {
    try {
      const localUser = localStorage.getItem('dhiyoni_admin_user');
      return localUser ? JSON.parse(localUser) : null;
    } catch {
      return null;
    }
  });
  const [initLoading, setInitLoading] = useState(true);

  // Overview Real-Time Aggregate Stats
  const [overviewStats, setOverviewStats] = useState({
    contacts: { total: 0, pending: 0 },
    parentSignups: { total: 0, pending: 0 },
    tutorSignups: { total: 0, pending: 0 },
    newsletters: { total: 0, pending: 0 },
    feedbacks: { total: 0, pending: 0 },
  });

  // Tab Data & Server Pagination States
  const [tabData, setTabData] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '10', 10),
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [userTypeFilter, setUserTypeFilter] = useState(searchParams.get('userType') || 'all');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  // Content Management States (Public profiles & gallery)
  const [tutors, setTutors] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [galleryFormData, setGalleryFormData] = useState({ url: '', alt: '', category: 'General' });
  const [tutorFormData, setTutorFormData] = useState({
    name: '',
    subject: '',
    qualification: '',
    experience: '',
    rating: '5.0',
    board: 'CBSE & ICSE',
    image: '',
  });

  // Modal & Password States
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(''); // 'view-parent' | 'view-tutor' | 'view-contact' | 'view-newsletter' | 'view-feedback' | 'add-tutor' | 'edit-tutor'
  const [copiedId, setCopiedId] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });

  // Google Sheets Export States (Phase 6)
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [activeExportJobId, setActiveExportJobId] = useState(() => {
    try {
      return sessionStorage.getItem('dhiyoni_active_export_jobId') || '';
    } catch {
      return '';
    }
  });
  const [activeExportJob, setActiveExportJob] = useState(null);

  // Token & Headers Helper
  const getHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('dhiyoni_admin_token') || ''}`,
    'Content-Type': 'application/json',
  }), []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('dhiyoni_admin_token');
    localStorage.removeItem('dhiyoni_admin_user');
    navigate('/admin/login');
  }, [navigate, getHeaders]);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'overview') params.set('tab', activeTab);
    if (searchQuery) params.set('search', searchQuery);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (userTypeFilter !== 'all') params.set('userType', userTypeFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (pagination.page > 1) params.set('page', String(pagination.page));
    if (pagination.limit !== 10) params.set('limit', String(pagination.limit));
    setSearchParams(params, { replace: true });
  }, [activeTab, searchQuery, statusFilter, userTypeFilter, startDate, endDate, pagination.page, pagination.limit, setSearchParams]);

  // Fetch Aggregated Dashboard Overview Statistics
  const fetchOverviewStats = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/dashboard-stats', { headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setOverviewStats(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load overview stats:', err);
    }
  }, [getHeaders]);

  // Fetch Server-Paginated Data for the Active Tab
  const fetchTabData = useCallback(async () => {
    const submissionTabs = ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'];
    if (!submissionTabs.includes(activeTab)) return;

    setTabLoading(true);
    setTabError('');

    try {
      const endpointMap = {
        contacts: '/api/contacts',
        parentSignups: '/api/parent-signups',
        tutorSignups: '/api/tutor-signups',
        newsletters: '/api/newsletters',
        feedbacks: '/api/feedback',
      };

      const url = new URL(endpointMap[activeTab], window.location.origin);
      url.searchParams.set('page', String(pagination.page));
      url.searchParams.set('limit', String(pagination.limit));

      if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());
      if (statusFilter && statusFilter !== 'all') url.searchParams.set('status', statusFilter);
      if (userTypeFilter && userTypeFilter !== 'all') url.searchParams.set('userType', userTypeFilter);
      if (startDate) url.searchParams.set('startDate', startDate);
      if (endDate) url.searchParams.set('endDate', endDate);

      const res = await fetch(url.toString(), { headers: getHeaders() });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Failed to fetch submission data');
      }

      // Handle both paginated response object and legacy raw array
      if (Array.isArray(json)) {
        setTabData(json);
        setPagination((prev) => ({
          ...prev,
          total: json.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }));
      } else {
        setTabData(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
      }
    } catch (err) {
      setTabError(err.message || 'Failed to retrieve records. Please try again.');
      setTabData([]);
    } finally {
      setTabLoading(false);
    }
  }, [activeTab, pagination.page, pagination.limit, searchQuery, statusFilter, userTypeFilter, startDate, endDate, getHeaders, handleLogout]);

  // Fetch Public Tutors & Gallery Content
  const fetchContentData = useCallback(async () => {
    try {
      const [resTutors, resGallery] = await Promise.all([
        fetch('/api/tutors'),
        fetch('/api/gallery'),
      ]);
      if (resTutors.ok) setTutors(await resTutors.json());
      if (resGallery.ok) setGalleries(await resGallery.json());
    } catch (err) {
      console.error('Failed to load content data:', err);
    }
  }, []);

  // Initial Auth Guard Verification
  useEffect(() => {
    document.title = 'Admin Dashboard | DHIYONI Tutorials';
    const token = localStorage.getItem('dhiyoni_admin_token');
    const localUser = localStorage.getItem('dhiyoni_admin_user');

    if (!token || !localUser) {
      handleLogout();
      return;
    }

    fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then(() => {
        setInitLoading(false);
        fetchOverviewStats();
        fetchContentData();
      })
      .catch((err) => {
        console.error(err);
        handleLogout();
      });
  }, [handleLogout, fetchOverviewStats, fetchContentData]);

  // Reload Tab Data whenever Active Tab or Filters Change
  useEffect(() => {
    if (initLoading) return;
    let ignore = false;

    const submissionTabs = ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'];
    if (!submissionTabs.includes(activeTab)) return;

    const endpointMap = {
      contacts: '/api/contacts',
      parentSignups: '/api/parent-signups',
      tutorSignups: '/api/tutor-signups',
      newsletters: '/api/newsletters',
      feedbacks: '/api/feedback',
    };

    const url = new URL(endpointMap[activeTab], window.location.origin);
    url.searchParams.set('page', String(pagination.page));
    url.searchParams.set('limit', String(pagination.limit));
    if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());
    if (statusFilter && statusFilter !== 'all') url.searchParams.set('status', statusFilter);
    if (userTypeFilter && userTypeFilter !== 'all') url.searchParams.set('userType', userTypeFilter);
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);

    // Asynchronous load to avoid synchronous setState inside effect body
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!ignore) {
        setTabLoading(true);
        setTabError('');
      }
    });

    fetch(url.toString(), { headers: getHeaders(), signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          handleLogout();
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to fetch submission data');
        if (!ignore) {
          if (Array.isArray(json)) {
            setTabData(json);
            setPagination((prev) => ({
              ...prev,
              total: json.length,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false,
            }));
          } else {
            setTabData(json.data || []);
            if (json.pagination) setPagination(json.pagination);
          }
        }
      })
      .catch((err) => {
        if (!ignore && err.name !== 'AbortError') {
          setTabError(err.message || 'Failed to retrieve records. Please try again.');
          setTabData([]);
        }
      })
      .finally(() => {
        if (!ignore) setTabLoading(false);
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [initLoading, activeTab, pagination.page, pagination.limit, searchQuery, statusFilter, userTypeFilter, startDate, endDate, getHeaders, handleLogout]);

  // Status Update Handler
  const updateStatus = async (type, id, status) => {
    try {
      const urlMap = {
        parent: `/api/parent-signups/${id}`,
        tutor: `/api/tutor-signups/${id}`,
        contact: `/api/contacts/${id}`,
      };

      const response = await fetch(urlMap[type], {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchTabData();
        fetchOverviewStats();
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem((prev) => ({ ...prev, status }));
        }
      }
    } catch (err) {
      console.error(`Failed to update status for ${type}:`, err);
    }
  };

  // Submission & Content Deletion Handler
  const deleteItem = async (type, id) => {
    if (!window.confirm(`Are you sure you want to permanently delete this ${type} record?`)) return;

    try {
      const urlMap = {
        parent: `/api/parent-signups/${id}`,
        tutor: `/api/tutor-signups/${id}`,
        contact: `/api/contacts/${id}`,
        newsletter: `/api/newsletters/${id}`,
        feedback: `/api/feedback/${id}`,
        tutorProfile: `/api/tutors/${id}`,
        gallery: `/api/gallery/${id}`,
      };

      const response = await fetch(urlMap[type], {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (response.ok) {
        fetchTabData();
        fetchOverviewStats();
        if (type === 'tutorProfile' || type === 'gallery') fetchContentData();
        setSelectedItem(null);
        setModalType('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to delete record.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Tutor CRUD Submit Handler
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
        body: JSON.stringify(tutorFormData),
      });

      if (response.ok) {
        setFormMsg({ type: 'success', text: `Tutor profile ${isEdit ? 'updated' : 'created'} successfully!` });
        setTutorFormData({ name: '', subject: '', qualification: '', experience: '', rating: '5.0', board: 'CBSE & ICSE', image: '' });
        fetchContentData();
        setTimeout(() => {
          setModalType('');
          setSelectedItem(null);
          setFormMsg({ type: '', text: '' });
        }, 1200);
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
      image: tutorItem.image,
    });
    setSelectedItem(tutorItem);
    setModalType('edit-tutor');
  };

  // Gallery Submit Handler
  const handleGallerySubmit = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });
    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(galleryFormData),
      });
      if (response.ok) {
        setFormMsg({ type: 'success', text: 'Image added to gallery!' });
        setGalleryFormData({ url: '', alt: '', category: 'General' });
        fetchContentData();
        setTimeout(() => setFormMsg({ type: '', text: '' }), 2500);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Operation failed');
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: err.message });
    }
  };

  // Change Password Handler
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
          newPassword: passwordForm.newPassword,
        }),
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

  // Clear Filters Handler
  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setUserTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Switch Tab Helper
  const handleTabSwitch = (newTab) => {
    setActiveTab(newTab);
    setSearchQuery('');
    setStatusFilter('all');
    setUserTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Copy Submission ID Helper
  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Helpers
  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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

  if (initLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-montserrat font-bold text-primary">Loading DHIYONI Admin Portal...</p>
        </div>
      </div>
    );
  }

  // Active filters check
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || userTypeFilter !== 'all' || startDate || endDate;

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
            {sidebarOpen && <span className="font-montserrat font-bold text-lg whitespace-nowrap">DHIYONI Panel</span>}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: 'dashboard' },
              {
                id: 'parentSignups',
                label: 'Parent Requests',
                icon: 'person_search',
                badge: overviewStats.parentSignups.pending,
              },
              {
                id: 'tutorSignups',
                label: 'Tutor Applications',
                icon: 'contact_page',
                badge: overviewStats.tutorSignups.pending,
              },
              {
                id: 'contacts',
                label: 'Inquiries',
                icon: 'mail',
                badge: overviewStats.contacts.pending,
              },
              {
                id: 'feedbacks',
                label: 'Feedbacks',
                icon: 'forum',
                badge: 0,
              },
              {
                id: 'newsletters',
                label: 'Newsletter List',
                icon: 'campaign',
              },
              {
                id: 'exportHistory',
                label: 'Export History',
                icon: 'table_chart',
              },
              { id: 'tutorsCrud', label: 'Manage Tutors', icon: 'groups' },
              { id: 'manageGallery', label: 'Manage Gallery', icon: 'photo_library' },
              { id: 'settings', label: 'Security Settings', icon: 'settings' },
            ].map(({ id, label, icon, badge }) => (
              <button
                key={id}
                onClick={() => handleTabSwitch(id)}
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
              {activeTab === 'tutorsCrud'
                ? 'Tutor Listings Manager'
                : activeTab === 'manageGallery'
                ? 'Gallery Media Manager'
                : activeTab === 'parentSignups'
                ? 'Parent & Student Registrations'
                : activeTab === 'tutorSignups'
                ? 'Tutor Applications'
                : activeTab === 'newsletters'
                ? 'Newsletter Subscribers'
                : activeTab === 'exportHistory'
                ? 'Google Sheets Export History'
                : activeTab.replace(/([A-Z])/g, ' $1')}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* One-Click Google Sheets Export Button */}
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-montserrat font-bold text-xs shadow-sm hover:shadow transition-all"
              title="Export Submissions to Google Sheets"
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span className="hidden sm:inline">Export to Sheets</span>
            </button>

            <div className="flex flex-col text-right hidden sm:block">
              <span className="font-montserrat text-label-md font-bold text-primary">{user?.username}</span>
              <span className="font-inter text-xs text-on-surface-variant">{user?.email}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold font-montserrat shadow-sm border border-outline-variant/30">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* Inner Scrollable Workspace */}
        <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-container-max w-full mx-auto">
          {/* TAB 1: OVERVIEW SCREEN */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                  {
                    tab: 'parentSignups',
                    label: 'Parent Signups',
                    count: overviewStats.parentSignups.total,
                    pending: overviewStats.parentSignups.pending,
                    icon: 'person_search',
                    color: 'bg-blue-500',
                  },
                  {
                    tab: 'tutorSignups',
                    label: 'Tutor Applications',
                    count: overviewStats.tutorSignups.total,
                    pending: overviewStats.tutorSignups.pending,
                    icon: 'contact_page',
                    color: 'bg-amber-500',
                  },
                  {
                    tab: 'contacts',
                    label: 'General Inquiries',
                    count: overviewStats.contacts.total,
                    pending: overviewStats.contacts.pending,
                    icon: 'mail',
                    color: 'bg-emerald-500',
                  },
                  {
                    tab: 'feedbacks',
                    label: 'User Feedbacks',
                    count: overviewStats.feedbacks.total,
                    pending: 0,
                    icon: 'forum',
                    color: 'bg-teal-600',
                  },
                  {
                    tab: 'newsletters',
                    label: 'Newsletter List',
                    count: overviewStats.newsletters.total,
                    pending: 0,
                    icon: 'campaign',
                    color: 'bg-purple-500',
                  },
                ].map(({ tab, label, count, pending, icon, color }) => (
                  <div
                    key={label}
                    onClick={() => handleTabSwitch(tab)}
                    className="bg-white p-6 rounded-2xl border border-outline-variant/30 teal-shadow flex items-center justify-between cursor-pointer hover:border-primary/40 transition-all group"
                  >
                    <div className="space-y-2">
                      <p className="font-montserrat text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                        {label}
                      </p>
                      <h3 className="font-montserrat text-3xl font-bold text-primary group-hover:text-accent-orange transition-colors">
                        {count}
                      </h3>
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

              {/* Quick Navigation Card */}
              <div className="bg-white p-8 rounded-2xl border border-outline-variant/30 teal-shadow space-y-4">
                <h3 className="font-montserrat font-bold text-xl text-primary">Data Management Center</h3>
                <p className="font-inter text-body-sm text-on-surface-variant max-w-2xl leading-relaxed">
                  Welcome to the DHIYONI Tutorials Centralized Submissions Hub. Use the sidebar to inspect, filter, paginate, and review parent inquiries, tutor submissions, contact messages, user feedback, and newsletter subscribers.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={() => handleTabSwitch('parentSignups')}
                    className="px-5 py-2.5 bg-blue-50 text-blue-700 font-montserrat font-bold rounded-xl text-xs hover:bg-blue-100 transition-colors"
                  >
                    Manage Parent Registrations →
                  </button>
                  <button
                    onClick={() => handleTabSwitch('tutorSignups')}
                    className="px-5 py-2.5 bg-amber-50 text-amber-700 font-montserrat font-bold rounded-xl text-xs hover:bg-amber-100 transition-colors"
                  >
                    Manage Tutor Applications →
                  </button>
                  <button
                    onClick={() => handleTabSwitch('contacts')}
                    className="px-5 py-2.5 bg-emerald-50 text-emerald-700 font-montserrat font-bold rounded-xl text-xs hover:bg-emerald-100 transition-colors"
                  >
                    Manage Contact Inquiries →
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(true)}
                    className="px-5 py-2.5 bg-emerald-600 text-white font-montserrat font-bold rounded-xl text-xs hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                    <span>Export to Google Sheets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('exportHistory')}
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 font-montserrat font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    <span>Export History</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENT / PARENT SIGNUP REQUESTS */}
          {activeTab === 'parentSignups' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              {/* Filter Controls Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search by student, parent, email, contact..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Enrolled">Enrolled</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  {/* Date Filters */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-on-surface-variant font-bold text-[11px]">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                    <span className="text-on-surface-variant font-bold text-[11px]">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Reset all search and date filters"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Error Banner */}
              {tabError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-body-sm flex items-center justify-between">
                  <span>{tabError}</span>
                  <button onClick={fetchTabData} className="underline font-bold text-xs">Retry</button>
                </div>
              )}

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
                    {tabLoading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-on-surface-variant font-medium">
                          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Loading records...
                        </td>
                      </tr>
                    ) : tabData.length > 0 ? (
                      tabData.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 whitespace-nowrap text-on-surface-variant font-medium" title={formatFullDate(item.createdAt)}>
                            {formatTime(item.createdAt)}
                          </td>
                          <td className="p-4 font-bold">{item.studentName}</td>
                          <td className="p-4 font-medium">
                            {item.grade} <span className="text-on-surface-variant text-[11px]">• {item.subject}</span>
                          </td>
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
                              onClick={() => {
                                setSelectedItem(item);
                                setModalType('view-parent');
                              }}
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-on-surface-variant font-medium">
                          <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-2">inbox</span>
                          No parent signup requests found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/20 text-body-sm">
                <div className="text-on-surface-variant text-xs font-medium">
                  {pagination.total > 0 ? (
                    <>
                      Showing <span className="font-bold text-primary">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-bold text-primary">{Math.min((pagination.page - 1) * pagination.limit + tabData.length, pagination.total)}</span> of{' '}
                      <span className="font-bold text-primary">{pagination.total}</span> records
                    </>
                  ) : (
                    '0 records found'
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-on-surface-variant">Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => {
                        setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }));
                      }}
                      className="bg-slate-50 border border-outline-variant rounded-lg px-2.5 py-1 text-xs font-bold text-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))}
                      disabled={!pagination.hasPrevPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="px-3 text-xs font-bold text-primary">
                      Page {pagination.page} of {pagination.totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={!pagination.hasNextPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TUTOR APPLICATIONS */}
          {activeTab === 'tutorSignups' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              {/* Filter Controls Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search by tutor name, email, qualification, subjects..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <div className="flex items-center gap-2 bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-on-surface-variant font-bold text-[11px]">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                    <span className="text-on-surface-variant font-bold text-[11px]">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Reset all filters"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {tabError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-body-sm flex items-center justify-between">
                  <span>{tabError}</span>
                  <button onClick={fetchTabData} className="underline font-bold text-xs">Retry</button>
                </div>
              )}

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
                    {tabLoading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-on-surface-variant font-medium">
                          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Loading applications...
                        </td>
                      </tr>
                    ) : tabData.length > 0 ? (
                      tabData.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 whitespace-nowrap text-on-surface-variant font-medium" title={formatFullDate(item.createdAt)}>
                            {formatTime(item.createdAt)}
                          </td>
                          <td className="p-4 font-bold">
                            <div className="flex flex-col">
                              <span>{item.fullName}</span>
                              <span className="text-[11px] font-normal text-on-surface-variant">{item.contact}</span>
                            </div>
                          </td>
                          <td className="p-4 font-medium">
                            {item.qualification} <span className="text-on-surface-variant text-[11px]">• {item.occupation}</span>
                          </td>
                          <td className="p-4 font-medium">
                            <div className="flex flex-col">
                              <span>{item.subjects}</span>
                              <span className="text-xs text-on-surface-variant">{item.grades}</span>
                            </div>
                          </td>
                          <td className="p-4 text-on-surface-variant">{item.location}</td>
                          <td className="p-4">
                            <select
                              value={item.status}
                              onChange={(e) => updateStatus('tutor', item._id, e.target.value)}
                              className={`px-2.5 py-1 rounded-full border text-[11px] font-bold outline-none cursor-pointer appearance-none text-center ${getStatusClass(item.status)}`}
                              style={{ textAlignLast: 'center' }}
                            >
                              <option value="Pending" className="text-amber-800 bg-white">Pending</option>
                              <option value="Interview Scheduled" className="text-blue-800 bg-white">Interview Scheduled</option>
                              <option value="Approved" className="text-emerald-800 bg-white">Approved</option>
                              <option value="Rejected" className="text-rose-800 bg-white">Rejected</option>
                            </select>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setModalType('view-tutor');
                              }}
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-on-surface-variant font-medium">
                          <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-2">inbox</span>
                          No tutor applications found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/20 text-body-sm">
                <div className="text-on-surface-variant text-xs font-medium">
                  {pagination.total > 0 ? (
                    <>
                      Showing <span className="font-bold text-primary">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-bold text-primary">{Math.min((pagination.page - 1) * pagination.limit + tabData.length, pagination.total)}</span> of{' '}
                      <span className="font-bold text-primary">{pagination.total}</span> records
                    </>
                  ) : (
                    '0 records found'
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-on-surface-variant">Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => {
                        setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }));
                      }}
                      className="bg-slate-50 border border-outline-variant rounded-lg px-2.5 py-1 text-xs font-bold text-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))}
                      disabled={!pagination.hasPrevPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="px-3 text-xs font-bold text-primary">
                      Page {pagination.page} of {pagination.totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={!pagination.hasNextPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONTACT INQUIRIES */}
          {activeTab === 'contacts' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              {/* Filter Controls Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name, email, subject, or message..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved</option>
                  </select>

                  <div className="flex items-center gap-2 bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-on-surface-variant font-bold text-[11px]">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                    <span className="text-on-surface-variant font-bold text-[11px]">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Reset all filters"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {tabError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-body-sm flex items-center justify-between">
                  <span>{tabError}</span>
                  <button onClick={fetchTabData} className="underline font-bold text-xs">Retry</button>
                </div>
              )}

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
                    {tabLoading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-on-surface-variant font-medium">
                          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Loading inquiries...
                        </td>
                      </tr>
                    ) : tabData.length > 0 ? (
                      tabData.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 whitespace-nowrap text-on-surface-variant font-medium" title={formatFullDate(item.createdAt)}>
                            {formatTime(item.createdAt)}
                          </td>
                          <td className="p-4 font-bold">{item.name}</td>
                          <td className="p-4 font-medium text-primary hover:underline">
                            <a href={`mailto:${item.email}`}>{item.email}</a>
                          </td>
                          <td className="p-4 font-semibold text-accent-orange">{item.subject}</td>
                          <td className="p-4 text-on-surface-variant truncate max-w-xs">{item.message}</td>
                          <td className="p-4">
                            <select
                              value={item.status}
                              onChange={(e) => updateStatus('contact', item._id, e.target.value)}
                              className={`px-2.5 py-1 rounded-full border text-[11px] font-bold outline-none cursor-pointer appearance-none text-center ${getStatusClass(item.status)}`}
                              style={{ textAlignLast: 'center' }}
                            >
                              <option value="Pending" className="text-amber-800 bg-white">Pending</option>
                              <option value="Resolved" className="text-emerald-800 bg-white">Resolved</option>
                            </select>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setModalType('view-contact');
                              }}
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-on-surface-variant font-medium">
                          <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-2">inbox</span>
                          No inquiries found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/20 text-body-sm">
                <div className="text-on-surface-variant text-xs font-medium">
                  {pagination.total > 0 ? (
                    <>
                      Showing <span className="font-bold text-primary">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-bold text-primary">{Math.min((pagination.page - 1) * pagination.limit + tabData.length, pagination.total)}</span> of{' '}
                      <span className="font-bold text-primary">{pagination.total}</span> records
                    </>
                  ) : (
                    '0 records found'
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-on-surface-variant">Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => {
                        setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }));
                      }}
                      className="bg-slate-50 border border-outline-variant rounded-lg px-2.5 py-1 text-xs font-bold text-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))}
                      disabled={!pagination.hasPrevPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="px-3 text-xs font-bold text-primary">
                      Page {pagination.page} of {pagination.totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={!pagination.hasNextPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NEWSLETTER LIST */}
          {activeTab === 'newsletters' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
                <div>
                  <h3 className="font-montserrat font-bold text-lg text-primary">Newsletter Subscriptions</h3>
                  <p className="font-inter text-xs text-on-surface-variant">Validated subscribers registered for educational insights.</p>
                </div>
                <span className="bg-primary-fixed text-primary text-xs font-bold px-3 py-1 rounded-full self-start">
                  {pagination.total} Subscribed
                </span>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search subscriber emails..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 text-xs w-full sm:w-auto">
                  <span className="text-on-surface-variant font-bold text-[11px]">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                  />
                  <span className="text-on-surface-variant font-bold text-[11px]">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1.5"
                  >
                    Clear
                  </button>
                )}
              </div>

              {tabError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-body-sm flex items-center justify-between">
                  <span>{tabError}</span>
                  <button onClick={fetchTabData} className="underline font-bold text-xs">Retry</button>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead className="bg-slate-50 text-primary font-montserrat font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="p-4">Email Address</th>
                      <th className="p-4">Joined Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {tabLoading ? (
                      <tr>
                        <td colSpan="3" className="text-center py-12 text-on-surface-variant font-medium">
                          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Loading subscribers...
                        </td>
                      </tr>
                    ) : tabData.length > 0 ? (
                      tabData.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-primary">{item.email}</td>
                          <td className="p-4 text-on-surface-variant" title={formatFullDate(item.createdAt)}>
                            {formatTime(item.createdAt)}
                          </td>
                          <td className="p-4 text-right space-x-3">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setModalType('view-newsletter');
                              }}
                              className="text-primary hover:text-accent-orange font-bold hover:underline"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => deleteItem('newsletter', item._id)}
                              className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="text-center py-10 text-on-surface-variant font-medium">
                          No subscribers registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/20 text-body-sm">
                <div className="text-on-surface-variant text-xs font-medium">
                  Page {pagination.page} of {pagination.totalPages || 1} ({pagination.total} total)
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))}
                    disabled={!pagination.hasPrevPage || tabLoading}
                    className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={!pagination.hasNextPage || tabLoading}
                    className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: FEEDBACKS */}
          {activeTab === 'feedbacks' && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 space-y-6 animate-fade-in">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div>
                  <h3 className="font-montserrat font-bold text-lg text-primary">User Feedbacks & Ratings</h3>
                  <p className="font-inter text-xs text-on-surface-variant">Reviews received from students, parents, and tutors.</p>
                </div>
                <span className="bg-primary-fixed text-primary text-xs font-bold px-3 py-1 rounded-full self-start">
                  {pagination.total} Feedbacks
                </span>
              </div>

              {/* Filter Controls Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name, email, or message..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-full bg-slate-50 border border-outline-variant rounded-xl py-2 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={userTypeFilter}
                    onChange={(e) => {
                      setUserTypeFilter(e.target.value);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 font-montserrat text-xs focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="all">All User Types</option>
                    <option value="Student">Student</option>
                    <option value="Parent">Parent</option>
                    <option value="Teacher">Teacher</option>
                  </select>

                  <div className="flex items-center gap-2 bg-slate-50 border border-outline-variant rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-on-surface-variant font-bold text-[11px]">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                    <span className="text-on-surface-variant font-bold text-[11px]">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      className="bg-transparent border-0 outline-none text-xs text-primary font-medium"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Reset all filters"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {tabError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-body-sm flex items-center justify-between">
                  <span>{tabError}</span>
                  <button onClick={fetchTabData} className="underline font-bold text-xs">Retry</button>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead className="bg-slate-50 text-primary font-montserrat font-bold border-b border-outline-variant/20">
                    <tr>
                      <th className="p-4">Date</th>
                      <th className="p-4">User Info</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Rating</th>
                      <th className="p-4">Message</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {tabLoading ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-on-surface-variant font-medium">
                          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Loading feedbacks...
                        </td>
                      </tr>
                    ) : tabData.length > 0 ? (
                      tabData.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/50">
                          <td className="p-4 text-on-surface-variant whitespace-nowrap" title={formatFullDate(item.createdAt)}>
                            {formatTime(item.createdAt)}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-primary">{item.name}</div>
                            <div className="text-on-surface-variant text-xs">{item.email}</div>
                            {item.contactNumber && <div className="text-on-surface-variant text-xs">{item.contactNumber}</div>}
                          </td>
                          <td className="p-4">
                            <span className="bg-surface-variant text-on-surface-variant px-2.5 py-1 rounded-full text-xs font-semibold">
                              {item.userType}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex text-[#FFB400]">
                              {[...Array(item.rating || 0)].map((_, i) => (
                                <span key={i} className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                                  star
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 min-w-[200px] max-w-[350px]">
                            <p className="text-on-surface-variant truncate whitespace-normal line-clamp-2">
                              {item.message}
                            </p>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap space-x-3">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setModalType('view-feedback');
                              }}
                              className="text-primary hover:text-accent-orange font-bold hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => deleteItem('feedback', item._id)}
                              className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center py-10 text-on-surface-variant font-medium">
                          No feedback entries found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/20 text-body-sm">
                <div className="text-on-surface-variant text-xs font-medium">
                  {pagination.total > 0 ? (
                    <>
                      Showing <span className="font-bold text-primary">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-bold text-primary">{Math.min((pagination.page - 1) * pagination.limit + tabData.length, pagination.total)}</span> of{' '}
                      <span className="font-bold text-primary">{pagination.total}</span> records
                    </>
                  ) : (
                    '0 records found'
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-on-surface-variant">Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => {
                        setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }));
                      }}
                      className="bg-slate-50 border border-outline-variant rounded-lg px-2.5 py-1 text-xs font-bold text-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))}
                      disabled={!pagination.hasPrevPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="px-3 text-xs font-bold text-primary">
                      Page {pagination.page} of {pagination.totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={!pagination.hasNextPage || tabLoading}
                      className="p-1.5 rounded-lg border border-outline-variant text-primary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TUTOR CONTENT CRUD */}
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
                {tutors.map((tutor) => (
                  <div key={tutor._id} className="bg-slate-50 border border-outline-variant/35 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group">
                    <div className="p-5 space-y-4">
                      <div className="flex gap-4 items-center">
                        <img
                          src={tutor.image || 'https://via.placeholder.com/150'}
                          alt={tutor.name}
                          className="w-16 h-16 rounded-full object-cover border border-outline-variant shrink-0"
                        />
                        <div>
                          <h4 className="font-montserrat font-bold text-primary">{tutor.name}</h4>
                          <span className="bg-tertiary-fixed text-primary px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-0.5">
                            {tutor.subject}
                          </span>
                        </div>
                      </div>

                      <div className="text-body-sm space-y-1.5 border-t border-b border-outline-variant/20 py-3 text-on-surface-variant font-medium">
                        <p className="flex justify-between"><span>Board:</span> <span className="font-bold text-primary">{tutor.board}</span></p>
                        <p className="flex justify-between"><span>Qual:</span> <span className="font-bold">{tutor.qualification}</span></p>
                        <p className="flex justify-between"><span>Experience:</span> <span className="font-bold">{tutor.experience}</span></p>
                        <p className="flex justify-between"><span>Rating:</span> <span className="font-bold text-accent-orange flex items-center gap-0.5">★ {tutor.rating}</span></p>
                      </div>
                    </div>

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

          {/* TAB 8: MANAGE GALLERY */}
          {activeTab === 'manageGallery' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 animate-fade-in">
                <div className="border-b border-outline-variant/20 pb-4 mb-4">
                  <h3 className="font-montserrat font-bold text-lg text-primary">Add New Image to Gallery</h3>
                  <p className="font-inter text-xs text-on-surface-variant">Provide an image URL to show on the public gallery page and home screen.</p>
                </div>
                {formMsg.text && (
                  <div className={`mb-4 p-4 border rounded-xl text-body-sm flex items-start gap-2 ${
                    formMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <span className="material-symbols-outlined shrink-0 text-[20px]">
                      {formMsg.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <span>{formMsg.text}</span>
                  </div>
                )}
                <form onSubmit={handleGallerySubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface block mb-1">Image URL *</label>
                    <input
                      type="url"
                      required
                      value={galleryFormData.url}
                      onChange={(e) => setGalleryFormData({ ...galleryFormData, url: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>
                  <div>
                    <label className="font-inter text-body-sm font-bold text-on-surface block mb-1">Category</label>
                    <input
                      type="text"
                      value={galleryFormData.category}
                      onChange={(e) => setGalleryFormData({ ...galleryFormData, category: e.target.value })}
                      placeholder="Classroom"
                      className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-body-sm"
                    />
                  </div>
                  <div className="md:col-span-3 text-right">
                    <button type="submit" className="bg-primary text-white font-montserrat font-bold py-2.5 px-6 rounded-xl hover:bg-primary-container transition-all shadow-md">
                      Add to Gallery
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow p-6 animate-fade-in">
                <h3 className="font-montserrat font-bold text-lg text-primary mb-4">Current Gallery</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {galleries.map((img) => (
                    <div key={img._id} className="relative group rounded-xl overflow-hidden aspect-square border border-outline-variant">
                      <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <span className="text-white text-xs font-bold">{img.category}</span>
                        <button onClick={() => deleteItem('gallery', img._id)} className="bg-rose-600 text-white p-1 rounded hover:bg-rose-700 text-xs text-center">Delete</button>
                      </div>
                    </div>
                  ))}
                  {galleries.length === 0 && (
                    <div className="col-span-full text-center py-8 text-on-surface-variant font-medium">No images in the gallery yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: GOOGLE SHEETS EXPORT HISTORY */}
          {activeTab === 'exportHistory' && (
            <ExportHistoryTab onOpenExportModal={() => setExportModalOpen(true)} />
          )}

          {/* TAB 9: SECURITY SETTINGS */}
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
              onClick={() => {
                setSelectedItem(null);
                setModalType('');
                setFormMsg({ type: '', text: '' });
                setCopiedId(false);
              }}
              className="absolute top-5 right-5 text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-full hover:bg-surface-container"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>

            {/* MODAL 1: VIEW CONTACT */}
            {modalType === 'view-contact' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">
                    General Inquiry
                  </span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.subject}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted: {formatFullDate(selectedItem.createdAt)}</p>
                </div>

                {/* Submission ID Banner */}
                <div className="bg-slate-50 border border-outline-variant/30 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-on-surface-variant font-bold">Submission UUID: </span>
                    <span className="font-mono text-primary font-semibold">{selectedItem.submissionId || 'Legacy record (No UUID)'}</span>
                  </div>
                  {selectedItem.submissionId && (
                    <button
                      onClick={() => copyToClipboard(selectedItem.submissionId)}
                      className="text-xs bg-white border border-outline-variant px-2.5 py-1 rounded-lg font-bold hover:bg-slate-50 text-primary flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">{copiedId ? 'check' : 'content_copy'}</span>
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-body-sm font-medium">
                  <p><span className="text-on-surface-variant">Contact Name:</span> <br /><span className="font-bold text-base text-primary">{selectedItem.name}</span></p>
                  <p><span className="text-on-surface-variant">Email Address:</span> <br /><span className="font-bold text-base text-primary hover:underline"><a href={`mailto:${selectedItem.email}`}>{selectedItem.email}</a></span></p>
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

            {/* MODAL 2: VIEW PARENT SIGNUP */}
            {modalType === 'view-parent' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">
                    Student Signup Request
                  </span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.studentName}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted: {formatFullDate(selectedItem.createdAt)}</p>
                </div>

                <div className="bg-slate-50 border border-outline-variant/30 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-on-surface-variant font-bold">Submission UUID: </span>
                    <span className="font-mono text-primary font-semibold">{selectedItem.submissionId || 'Legacy record (No UUID)'}</span>
                  </div>
                  {selectedItem.submissionId && (
                    <button
                      onClick={() => copyToClipboard(selectedItem.submissionId)}
                      className="text-xs bg-white border border-outline-variant px-2.5 py-1 rounded-lg font-bold hover:bg-slate-50 text-primary flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">{copiedId ? 'check' : 'content_copy'}</span>
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  )}
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
                  <p><span className="text-on-surface-variant">Referral Source:</span> <span className="font-bold text-primary ml-2 capitalize">{selectedItem.referral ? selectedItem.referral.replace('_', ' ') : 'None'}</span></p>
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

            {/* MODAL 3: VIEW TUTOR APPLICATION */}
            {modalType === 'view-tutor' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">
                    Tutor Application
                  </span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.fullName}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted: {formatFullDate(selectedItem.createdAt)}</p>
                </div>

                <div className="bg-slate-50 border border-outline-variant/30 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-on-surface-variant font-bold">Submission UUID: </span>
                    <span className="font-mono text-primary font-semibold">{selectedItem.submissionId || 'Legacy record (No UUID)'}</span>
                  </div>
                  {selectedItem.submissionId && (
                    <button
                      onClick={() => copyToClipboard(selectedItem.submissionId)}
                      className="text-xs bg-white border border-outline-variant px-2.5 py-1 rounded-lg font-bold hover:bg-slate-50 text-primary flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">{copiedId ? 'check' : 'content_copy'}</span>
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                    <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Personal Details</h4>
                    <p><span className="text-on-surface-variant">Gender:</span> <span className="float-right font-bold capitalize">{selectedItem.gender}</span></p>
                    <p><span className="text-on-surface-variant">D.O.B:</span> <span className="float-right font-bold">{selectedItem.dob ? new Date(selectedItem.dob).toLocaleDateString('en-IN') : 'N/A'}</span></p>
                    <p><span className="text-on-surface-variant">Location:</span> <span className="float-right font-bold truncate max-w-[150px]">{selectedItem.location}</span></p>
                    <p><span className="text-on-surface-variant">Contact:</span> <span className="float-right font-bold text-primary"><a href={`tel:${selectedItem.contact}`}>{selectedItem.contact}</a></span></p>
                    <p><span className="text-on-surface-variant">Email:</span> <span className="float-right font-bold text-primary hover:underline truncate max-w-[150px]"><a href={`mailto:${selectedItem.email}`}>{selectedItem.email}</a></span></p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                    <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Academic & Experience</h4>
                    <p><span className="text-on-surface-variant">Highest Degree:</span> <span className="float-right font-bold">{selectedItem.qualification}</span></p>
                    <p><span className="text-on-surface-variant">Occupation:</span> <span className="float-right font-bold capitalize">{selectedItem.occupation}</span></p>
                    <p><span className="text-on-surface-variant">Grades can teach:</span> <span className="float-right font-bold">{selectedItem.grades}</span></p>
                    <p><span className="text-on-surface-variant">Subjects handle:</span> <span className="float-right font-bold text-accent-orange">{selectedItem.subjects}</span></p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl text-body-sm space-y-2 font-medium">
                  <h4 className="font-montserrat font-bold text-primary border-b border-outline-variant/10 pb-1 mb-2">Logistics & Availability</h4>
                  <p><span className="text-on-surface-variant">Preferred time:</span> <span className="font-bold float-right">{selectedItem.time}</span></p>
                  <p><span className="text-on-surface-variant">Boards preference:</span> <span className="font-bold float-right uppercase">{Array.isArray(selectedItem.boards) ? selectedItem.boards.join(', ') : 'None'}</span></p>
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

            {/* MODAL 4: VIEW NEWSLETTER SUBSCRIBER */}
            {modalType === 'view-newsletter' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <span className="inline-block bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">
                    Newsletter Subscriber
                  </span>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.email}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Subscribed: {formatFullDate(selectedItem.createdAt)}</p>
                </div>

                <div className="bg-slate-50 border border-outline-variant/30 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-on-surface-variant font-bold">Submission UUID: </span>
                    <span className="font-mono text-primary font-semibold">{selectedItem.submissionId || 'Legacy record (No UUID)'}</span>
                  </div>
                  {selectedItem.submissionId && (
                    <button
                      onClick={() => copyToClipboard(selectedItem.submissionId)}
                      className="text-xs bg-white border border-outline-variant px-2.5 py-1 rounded-lg font-bold hover:bg-slate-50 text-primary flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">{copiedId ? 'check' : 'content_copy'}</span>
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-body-sm font-medium">
                  <p><span className="text-on-surface-variant">Email Address:</span> <span className="float-right font-bold text-primary">{selectedItem.email}</span></p>
                  <p><span className="text-on-surface-variant">Registration Date:</span> <span className="float-right font-bold">{formatFullDate(selectedItem.createdAt)}</span></p>
                </div>

                <div className="flex justify-end border-t border-outline-variant/20 pt-6">
                  <button
                    onClick={() => deleteItem('newsletter', selectedItem._id)}
                    className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Remove Subscriber
                  </button>
                </div>
              </div>
            )}

            {/* MODAL 5: VIEW FEEDBACK */}
            {modalType === 'view-feedback' && selectedItem && (
              <div className="space-y-6">
                <div className="border-b border-outline-variant/20 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block bg-teal-100 text-teal-800 border border-teal-200 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      User Feedback
                    </span>
                    <span className="inline-block bg-surface-variant text-on-surface-variant px-2.5 py-1 rounded-full text-xs font-semibold">
                      {selectedItem.userType}
                    </span>
                  </div>
                  <h3 className="font-montserrat font-bold text-2xl text-primary">{selectedItem.name}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Submitted: {formatFullDate(selectedItem.createdAt)}</p>
                </div>

                <div className="bg-slate-50 border border-outline-variant/30 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-on-surface-variant font-bold">Submission UUID: </span>
                    <span className="font-mono text-primary font-semibold">{selectedItem.submissionId || 'Legacy record (No UUID)'}</span>
                  </div>
                  {selectedItem.submissionId && (
                    <button
                      onClick={() => copyToClipboard(selectedItem.submissionId)}
                      className="text-xs bg-white border border-outline-variant px-2.5 py-1 rounded-lg font-bold hover:bg-slate-50 text-primary flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">{copiedId ? 'check' : 'content_copy'}</span>
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-body-sm font-medium">
                  <p><span className="text-on-surface-variant">User Type:</span> <br /><span className="font-bold text-base text-primary">{selectedItem.userType}</span></p>
                  <p><span className="text-on-surface-variant">Email Address:</span> <br /><span className="font-bold text-base text-primary hover:underline"><a href={`mailto:${selectedItem.email}`}>{selectedItem.email}</a></span></p>
                  {selectedItem.contactNumber && (
                    <p><span className="text-on-surface-variant">Contact Number:</span> <br /><span className="font-bold text-base text-primary">{selectedItem.contactNumber}</span></p>
                  )}
                  <p>
                    <span className="text-on-surface-variant">Rating Score:</span> <br />
                    <span className="inline-flex text-[#FFB400] text-base font-bold items-center gap-1 mt-1">
                      {[...Array(selectedItem.rating || 0)].map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                          star
                        </span>
                      ))}
                      <span className="text-xs text-on-surface-variant font-medium ml-1">({selectedItem.rating} / 5)</span>
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-montserrat font-semibold text-body-sm text-primary">Feedback Message:</h4>
                  <div className="bg-slate-50 p-4 rounded-xl font-inter text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line border border-outline-variant/20">
                    {selectedItem.message}
                  </div>
                </div>

                <div className="flex justify-end border-t border-outline-variant/20 pt-6">
                  <button
                    onClick={() => deleteItem('feedback', selectedItem._id)}
                    className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-montserrat font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Delete Feedback
                  </button>
                </div>
              </div>
            )}

            {/* MODAL 6: ADD / EDIT TUTOR */}
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
                      onClick={() => {
                        setSelectedItem(null);
                        setModalType('');
                      }}
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
      {/* ── GOOGLE SHEETS EXPORT MODAL & TRACKER (PHASE 6) ────── */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportStarted={(result) => {
          setActiveExportJobId(result.jobId);
          setActiveExportJob(result);
        }}
      />

      {activeExportJobId && (
        <ExportStatusTracker
          jobId={activeExportJobId}
          initialData={activeExportJob}
          onJobComplete={() => {
            fetchOverviewStats();
          }}
          onDismiss={() => {
            setActiveExportJobId('');
            setActiveExportJob(null);
          }}
        />
      )}
    </div>
  );
}
