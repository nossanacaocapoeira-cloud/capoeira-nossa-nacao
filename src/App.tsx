import React from 'react';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Public pages
import { LandingPage } from './components/public/LandingPage';
import { LoginPage } from './components/public/LoginPage';
import { RegisterPage } from './components/public/RegisterPage';
import { ForgotPasswordPage } from './components/public/ForgotPasswordPage';

// Student pages
import { StudentLayout } from './components/student/StudentLayout';
import { StudentHome } from './components/student/StudentHome';
import { StudentFees } from './components/student/StudentFees';
import { StudentProducts } from './components/student/StudentProducts';
import { StudentHistory } from './components/student/StudentHistory';
import { StudentProfile } from './components/student/StudentProfile';

// Admin pages
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminStudents } from './components/admin/AdminStudents';
import { AdminStudentDetail } from './components/admin/AdminStudentDetail';
import { AdminFees } from './components/admin/AdminFees';
import { AdminProducts } from './components/admin/AdminProducts';
import { AdminPayments } from './components/admin/AdminPayments';
import { AdminMovements } from './components/admin/AdminMovements';
import { AdminBirthdays } from './components/admin/AdminBirthdays';
import { AdminSettings } from './components/admin/AdminSettings';

import { ShieldAlert, ArrowLeft } from 'lucide-react';

function AppRouter() {
  const { path, navigate } = useNavigation();
  const { user, profile, loading, isAdmin } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0e11] flex flex-col items-center justify-center text-neutral-100 selection:bg-amber-500 selection:text-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-neutral-950 font-black text-xl flex items-center justify-center shadow-xl shadow-amber-500/20 animate-pulse">
            CNN
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-sm font-black uppercase tracking-wider text-neutral-100">
              Capoeira Nossa Nação
            </h1>
            <p className="text-xs text-neutral-400 font-mono">Carregando sistema...</p>
          </div>
        </div>
      </div>
    );
  }

  // Public Routes
  if (path === '/') {
    return <LandingPage />;
  }

  if (path === '/login') {
    return <LoginPage />;
  }

  if (path === '/cadastro') {
    return <RegisterPage />;
  }

  if (path === '/recuperar-senha') {
    return <ForgotPasswordPage />;
  }

  // Auth Guard for private routes
  if (!user) {
    return <LoginPage />;
  }

  // Admin Routes (/admin/*)
  if (path.startsWith('/admin')) {
    // If not admin, show permission notice with button to student area
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-[#0e0f11] flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-[#141619] border border-[#25282f] rounded-2xl text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-neutral-100">Acesso Restrito</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Você está conectado como <strong>{profile?.full_name || user.email}</strong>, porém este perfil não
                possui privilégios de Administrador da academia.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => navigate('/app')}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs transition"
              >
                Ir para Minha Área do Aluno
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 text-neutral-400 hover:text-white text-xs transition"
              >
                Trocar de Conta
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Specific Student detail route: /admin/alunos/:id
    if (path.startsWith('/admin/alunos/')) {
      const studentId = path.replace('/admin/alunos/', '').trim();
      if (studentId) {
        return (
          <AdminLayout>
            <ErrorBoundary
              fallbackTitle="Erro ao exibir ficha do aluno"
              fallbackDescription="Os dados do aluno estão preservados no banco de dados. Ocorreu um erro temporário na renderização."
              showBackToStudents={true}
            >
              <AdminStudentDetail studentId={studentId} />
            </ErrorBoundary>
          </AdminLayout>
        );
      }
    }

    // Other Admin routes
    const cleanPath = path.split('?')[0];
    let adminContent = <AdminDashboard />;
    if (cleanPath === '/admin/alunos') {
      adminContent = <AdminStudents />;
    } else if (cleanPath === '/admin/mensalidades') {
      adminContent = <AdminFees />;
    } else if (cleanPath === '/admin/produtos') {
      adminContent = <AdminProducts />;
    } else if (cleanPath === '/admin/pagamentos') {
      adminContent = <AdminPayments />;
    } else if (cleanPath === '/admin/movimentacoes') {
      adminContent = <AdminMovements />;
    } else if (cleanPath === '/admin/aniversariantes') {
      adminContent = <AdminBirthdays />;
    } else if (cleanPath === '/admin/configuracoes') {
      adminContent = <AdminSettings />;
    }

    return <AdminLayout>{adminContent}</AdminLayout>;
  }

  // Student Routes (/app/*)
  const cleanStudentPath = path.split('?')[0];
  let studentContent = <StudentHome />;
  if (cleanStudentPath === '/app/mensalidades') {
    studentContent = <StudentFees />;
  } else if (cleanStudentPath === '/app/produtos') {
    studentContent = <StudentProducts />;
  } else if (cleanStudentPath === '/app/historico') {
    studentContent = <StudentHistory />;
  } else if (cleanStudentPath === '/app/perfil') {
    studentContent = <StudentProfile />;
  }

  return <StudentLayout>{studentContent}</StudentLayout>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <NavigationProvider>
            <AppRouter />
          </NavigationProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
