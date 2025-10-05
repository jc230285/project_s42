"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { WithScale42Access } from '@/components/WithScale42Access';
import toast from 'react-hot-toast';

interface Company {
  id: number;
  full_name: string;
  registration_number?: string;
  company_type?: string;
  company_status?: string;
  incorporated_on?: string;
  address_line1?: string;
  address_city?: string;
  address_post_code?: string;
  address_country_iso2?: string;
  description_of_business?: string;
  business_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  type?: string;
  user_id?: number;
  public_id?: string;
  avatar_url?: string;
  name?: string;
  currency_code?: string;
  is_active?: boolean;
  notes?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  directors?: any[];
  [key: string]: any;
}

interface Account {
  id: number;
  company_id: number;
  account_name: string;
  account_type: string;
  currency_code: string;
  balance: number;
  wise_reserved_amount?: number;
  account_number?: string;
  iban?: string;
  bic?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  notes?: string;
  company?: Company;
}

interface Director {
  id: number;
  company_id: number;
  name: string;
  address?: string;
  appointed_on?: string;
  resigned_on?: string;
  role?: string;
  is_active: boolean;
}

interface Document {
  id: number;
  company_id: number;
  document_type: string;
  file_name: string;
  file_path?: string;
  uploaded_at?: string;
  description?: string;
}

export default function AccountsPage() {
  return (
    <WithScale42Access>
      <AccountsPageContent />
    </WithScale42Access>
  );
}

function AccountsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'accounts' | 'directors' | 'documents'>('accounts');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!session?.user?.email) {
        throw new Error("No session available");
      }

      // Fetch companies and accounts from management_accounts database
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8150';
      const response = await fetch(`${backendUrl}/management-accounts`, {
        headers: {
          'Authorization': `Bearer ${session.user.email}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const data = await response.json();
      const sortedCompanies = (data.companies || []).sort((a: Company, b: Company) => 
        (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '')
      );
      const sortedAccounts = (data.accounts || []).sort((a: Account, b: Account) => 
        (b.balance || 0) - (a.balance || 0)
      );
      
      setCompanies(sortedCompanies);
      setAccounts(sortedAccounts);
      setDirectors(data.directors || []);
      setDocuments(data.documents || []);
      
      if (sortedCompanies.length > 0 && !selectedCompany) {
        setSelectedCompany(sortedCompanies[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getCompanyAccounts = (companyId: number) => {
    return accounts.filter(account => account.company_id === companyId);
  };

  const getCompanyDirectors = (companyId: number) => {
    return directors.filter(director => director.company_id === companyId);
  };

  const getCompanyDocuments = (companyId: number) => {
    return documents.filter(document => document.company_id === companyId);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Add Buttons */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Management Accounts</h1>
            <p className="mt-2 text-muted-foreground">Manage companies, accounts, directors, and documents</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Add Company
            </button>
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors"
            >
              Add Account
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Companies List */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">Companies</h2>
                  <p className="text-sm text-muted-foreground">{companies.length} companies</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      onClick={() => setSelectedCompany(company)}
                      className={`p-3 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedCompany?.id === company.id ? 'bg-muted border-l-4 border-l-primary' : ''
                      }`}
                    >
                      <h3 className="font-medium text-foreground text-sm">
                        {company.full_name || company.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {company.registration_number && `Reg: ${company.registration_number}`}
                        {company.company_status && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                            company.company_status?.toLowerCase().includes('active') 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {company.company_status}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div className="lg:col-span-3">
              {selectedCompany ? (
                <div className="bg-card rounded-lg border border-border">
                  {/* Company Header */}
                  <div className="p-6 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          {selectedCompany.full_name || selectedCompany.name}
                        </h2>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          {selectedCompany.registration_number && (
                            <span>Reg: {selectedCompany.registration_number}</span>
                          )}
                          {selectedCompany.company_type && (
                            <span>Type: {selectedCompany.company_type}</span>
                          )}
                          {selectedCompany.incorporated_on && (
                            <span>Founded: {new Date(selectedCompany.incorporated_on).toLocaleDateString()}</span>
                          )}
                        </div>
                        {selectedCompany.description_of_business && (
                          <p className="mt-3 text-muted-foreground">{selectedCompany.description_of_business}</p>
                        )}
                      </div>
                      {selectedCompany.avatar_url && (
                        <img 
                          src={selectedCompany.avatar_url} 
                          alt="Company" 
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-border">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                      {(['accounts', 'directors', 'documents'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                            activeTab === tab
                              ? 'border-primary text-primary'
                              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                          }`}
                        >
                          {tab}
                          <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                            {tab === 'accounts' && getCompanyAccounts(selectedCompany.id).length}
                            {tab === 'directors' && getCompanyDirectors(selectedCompany.id).length}
                            {tab === 'documents' && getCompanyDocuments(selectedCompany.id).length}
                          </span>
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6">
                    {activeTab === 'accounts' && (
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Accounts</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-medium text-foreground">Account Name</th>
                                <th className="text-left py-3 px-4 font-medium text-foreground">Type</th>
                                <th className="text-left py-3 px-4 font-medium text-foreground">Currency</th>
                                <th className="text-right py-3 px-4 font-medium text-foreground">Balance</th>
                                <th className="text-left py-3 px-4 font-medium text-foreground">Account Number</th>
                                <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getCompanyAccounts(selectedCompany.id).map((account) => (
                                <tr key={account.id} className="border-b border-border/50 hover:bg-muted/50">
                                  <td className="py-3 px-4 text-foreground font-medium">{account.account_name}</td>
                                  <td className="py-3 px-4 text-foreground">{account.account_type}</td>
                                  <td className="py-3 px-4 text-foreground">{account.currency_code}</td>
                                  <td className="py-3 px-4 text-right text-foreground font-mono">
                                    {formatCurrency(account.balance, account.currency_code)}
                                  </td>
                                  <td className="py-3 px-4 text-foreground font-mono text-sm">
                                    {account.account_number || account.iban || '-'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                      account.is_active 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}>
                                      {account.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {getCompanyAccounts(selectedCompany.id).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No accounts found for this company</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'directors' && (
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Directors</h3>
                        <div className="grid gap-4">
                          {getCompanyDirectors(selectedCompany.id).map((director) => (
                            <div key={director.id} className="border border-border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-foreground">{director.name}</h4>
                                  {director.role && (
                                    <p className="text-sm text-muted-foreground">{director.role}</p>
                                  )}
                                  {director.address && (
                                    <p className="text-sm text-muted-foreground mt-1">{director.address}</p>
                                  )}
                                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                    {director.appointed_on && (
                                      <span>Appointed: {new Date(director.appointed_on).toLocaleDateString()}</span>
                                    )}
                                    {director.resigned_on && (
                                      <span>Resigned: {new Date(director.resigned_on).toLocaleDateString()}</span>
                                    )}
                                  </div>
                                </div>
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  director.is_active 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {director.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          ))}
                          {getCompanyDirectors(selectedCompany.id).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No directors found for this company</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'documents' && (
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-4">Documents</h3>
                        <div className="grid gap-4">
                          {getCompanyDocuments(selectedCompany.id).map((document) => (
                            <div key={document.id} className="border border-border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-foreground">{document.file_name}</h4>
                                  <p className="text-sm text-muted-foreground">{document.document_type}</p>
                                  {document.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{document.description}</p>
                                  )}
                                  {document.uploaded_at && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <button className="text-primary hover:text-primary/80 text-sm">
                                  Download
                                </button>
                              </div>
                            </div>
                          ))}
                          {getCompanyDocuments(selectedCompany.id).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No documents found for this company</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-card rounded-lg border border-border p-12 text-center">
                  <p className="text-muted-foreground">Select a company to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Company Modal */}
        {showAddCompanyModal && (
          <AddCompanyModal
            onClose={() => setShowAddCompanyModal(false)}
            onSuccess={() => {
              setShowAddCompanyModal(false);
              fetchData();
            }}
          />
        )}

        {/* Add Account Modal */}
        {showAddAccountModal && (
          <AddAccountModal
            companies={companies}
            onClose={() => setShowAddAccountModal(false)}
            onSuccess={() => {
              setShowAddAccountModal(false);
              fetchData();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// Add Company Modal Component
function AddCompanyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    full_name: '',
    registration_number: '',
    company_type: '',
    company_status: 'Active',
    description_of_business: '',
    address_line1: '',
    address_city: '',
    address_post_code: '',
    address_country_iso2: 'GB',
    currency_code: 'GBP',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8150';
      const response = await fetch(`${backendUrl}/management-accounts/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Company created successfully');
        onSuccess();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || 'Failed to create company');
        throw new Error('Failed to create company');
      }
    } catch (error) {
      console.error('Error creating company:', error);
      if (error instanceof Error && error.message !== 'Failed to create company') {
        toast.error('Failed to create company');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Add New Company</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Registration Number</label>
              <input
                type="text"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company Type</label>
              <select
                value={formData.company_type}
                onChange={(e) => setFormData({ ...formData, company_type: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Type</option>
                <option value="LIMITED">Limited</option>
                <option value="PLC">PLC</option>
                <option value="LLP">LLP</option>
                <option value="SOLE_TRADER">Sole Trader</option>
                <option value="PARTNERSHIP">Partnership</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select
                value={formData.company_status}
                onChange={(e) => setFormData({ ...formData, company_status: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Active">Active</option>
                <option value="Dissolved">Dissolved</option>
                <option value="Dormant">Dormant</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description of Business</label>
            <textarea
              value={formData.description_of_business}
              onChange={(e) => setFormData({ ...formData, description_of_business: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Address Line 1</label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">City</label>
              <input
                type="text"
                value={formData.address_city}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Post Code</label>
              <input
                type="text"
                value={formData.address_post_code}
                onChange={(e) => setFormData({ ...formData, address_post_code: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Account Modal Component
function AddAccountModal({ 
  companies, 
  onClose, 
  onSuccess 
}: { 
  companies: Company[]; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [formData, setFormData] = useState({
    company_id: '',
    account_name: '',
    account_type: 'bank',
    currency_code: 'GBP',
    balance: '',
    account_number: '',
    iban: '',
    bic: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8150';
      const response = await fetch(`${backendUrl}/management-accounts/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          balance: parseFloat(formData.balance) || 0,
          company_id: parseInt(formData.company_id),
        }),
      });

      if (response.ok) {
        toast.success('Account created successfully');
        onSuccess();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || 'Failed to create account');
        throw new Error('Failed to create account');
      }
    } catch (error) {
      console.error('Error creating account:', error);
      if (error instanceof Error && error.message !== 'Failed to create account') {
        toast.error('Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Add New Account</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Company *</label>
              <select
                required
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.full_name || company.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Name *</label>
              <input
                type="text"
                required
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Type</label>
              <select
                value={formData.account_type}
                onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="bank">Bank</option>
                <option value="savings">Savings</option>
                <option value="investment">Investment</option>
                <option value="credit">Credit</option>
                <option value="loan">Loan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
              <select
                value={formData.currency_code}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="NOK">NOK</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Initial Balance</label>
              <input
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Number</label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">IBAN</label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">BIC/SWIFT</label>
              <input
                type="text"
                value={formData.bic}
                onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}