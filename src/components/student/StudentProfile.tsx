import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService } from '../../lib/dbService';
import { formatDate, ACADEMY_INFO } from '../../lib/utils';
import { User, Phone, MapPin, Calendar, Mail, ShieldCheck, LogOut, MessageCircle, Instagram } from 'lucide-react';
import { BackToHomeButton } from './BackToHomeButton';

export function StudentProfile() {
  const { profile: authProfile, signOut } = useAuth();
  const { navigate, previewStudent } = useNavigation();
  const [profile, setProfile] = useState<any>(authProfile);

  useEffect(() => {
    if (previewStudent?.id) {
      dbService.getStudentById(previewStudent.id).then((st) => {
        if (st) {
          setProfile({
            full_name: st.full_name,
            nickname: st.nickname,
            date_of_birth: st.date_of_birth,
            address: st.address,
            whatsapp: st.whatsapp,
            email: (st as any).email || authProfile?.email,
            active: st.active,
          });
        }
      });
    } else {
      setProfile(authProfile);
    }
  }, [previewStudent, authProfile]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      {/* Voltar ao início */}
      <BackToHomeButton id="btn-back-home-profile" />

      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-100 font-display">
          Meu Perfil
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
          Suas informações cadastrais na Capoeira Nossa Nação
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#111317]/85 border border-white/[0.06] space-y-6 shadow-xl backdrop-blur-md relative overflow-hidden">
        {/* Subtle glass line */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Avatar & Names */}
        <div className="flex items-center gap-4 pb-5 border-b border-white/[0.06]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-neutral-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0 font-display border border-amber-300/40">
            {profile?.nickname ? profile.nickname.substring(0, 2).toUpperCase() : 'AL'}
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
              Apelido na Capoeira
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-neutral-100 font-display">
              {profile?.nickname || 'Não informado'}
            </h3>
            <p className="text-xs text-neutral-400">{profile?.full_name}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="p-3.5 bg-black/40 rounded-2xl border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              E-mail
            </span>
            <p className="font-semibold text-neutral-200 truncate">{profile?.email || '-'}</p>
          </div>

          <div className="p-3.5 bg-black/40 rounded-2xl border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              WhatsApp
            </span>
            <p className="font-semibold text-neutral-200">{profile?.whatsapp || '-'}</p>
          </div>

          <div className="p-3.5 bg-black/40 rounded-2xl border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Data de Nascimento
            </span>
            <p className="font-semibold text-neutral-200">{formatDate(profile?.date_of_birth)}</p>
          </div>

          <div className="p-3.5 bg-black/40 rounded-2xl border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Status da Matrícula
            </span>
            <p className="font-semibold text-emerald-400">
              {profile?.active ? 'Ativa Oficial' : 'Inativa'}
            </p>
          </div>

          <div className="p-3.5 bg-black/40 rounded-2xl border border-white/[0.06] space-y-1 sm:col-span-2">
            <span className="text-[10px] uppercase font-mono text-neutral-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Endereço
            </span>
            <p className="font-semibold text-neutral-200">{profile?.address || '-'}</p>
          </div>
        </div>

        {/* Notice regarding updates */}
        <p className="text-[11px] text-neutral-400 text-center leading-relaxed">
          Para alterar dados cadastrais sensíveis, entre em contato diretamente com a administração da academia.
        </p>

        {/* Logout button */}
        <button
          id="btn-profile-logout"
          type="button"
          onClick={handleLogout}
          className="w-full py-3.5 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/60 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer shadow-sm active:scale-98 font-display"
        >
          <LogOut className="w-4 h-4" />
          Sair da Conta
        </button>
      </div>

      {/* Academy Contacts */}
      <div className="p-6 rounded-3xl bg-[#111317]/85 border border-white/[0.06] hover:border-amber-500/20 transition-all space-y-3.5 backdrop-blur-md shadow-xl">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-200 font-display">
          Canais Oficiais da Academia
        </h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={ACADEMY_INFO.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 text-xs font-bold transition font-display cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            WhatsApp: {ACADEMY_INFO.whatsapp}
          </a>
          <a
            href={ACADEMY_INFO.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 text-xs font-bold transition font-display cursor-pointer"
          >
            <Instagram className="w-4 h-4 text-amber-400" />
            {ACADEMY_INFO.instagram}
          </a>
        </div>
      </div>
    </div>
  );
}
