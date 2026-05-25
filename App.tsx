import { motion, AnimatePresence } from 'motion/react';
import { Search, Globe, Home, Info, X, ChevronLeft, LayoutGrid, MonitorPlay, Cast, Ghost, Youtube, Instagram, Music2, Play, Download, Smartphone, RefreshCw, Sparkles, Bell, BellOff, Share, Compass, Plus, Tv, Megaphone, Phone, MessageCircle } from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import { Category, Language, Channel } from './types';
import { CHANNELS, CATEGORIES } from './data';

// --- Subcomponents ---

const SearchBar = ({ value, onChange, placeholder, inputRef }: { value: string; onChange: (v: string) => void; placeholder: string; inputRef?: React.RefObject<HTMLInputElement> }) => (
  <div className="px-4 py-4 sticky top-0 bg-brand-bg/80 backdrop-blur-md z-10">
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted w-5 h-5" />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className="w-full bg-brand-card/50 border border-white/5 rounded-2xl py-3 ps-10 pe-4 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

interface ChannelCardProps {
  id?: string;
  name: string;
  logo: string;
  onClick: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ id, name, logo, onClick }) => (
  <motion.button
    id={id}
    layout
    type="button"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="w-full bg-brand-card/40 rounded-[28px] p-5 flex flex-col items-center justify-center gap-4 text-center cursor-pointer border border-white/5 hover:bg-brand-card/60 transition-all shadow-xl hover:scale-[1.03] focus:scale-105 focus:outline-none focus:ring-4 focus:ring-brand-accent focus:bg-brand-card/85 outline-none duration-150"
  >
    <div className="w-20 h-20 rounded-[22px] overflow-hidden flex items-center justify-center bg-black/20 p-1">
      <img src={logo} alt={name} className="w-full h-full object-cover rounded-[18px]" referrerPolicy="no-referrer" />
    </div>
    <span className="font-bold text-sm text-white/90 line-clamp-1">{name}</span>
  </motion.button>
);

const isHlsUrl = (url: string) => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  
  // Explicit HLS indicators
  if (lowerUrl.includes('.m3u8')) return true;
  if (lowerUrl.includes('.smil')) return true;
  if (lowerUrl.includes('/hls/')) return true;
  if (lowerUrl.includes('playlist')) return true;
  if (lowerUrl.includes('master')) return true;
  if (lowerUrl.includes('chunks.m3u8')) return true;
  if (lowerUrl.includes('karwan.tv')) return true;

  try {
    const urlObj = new URL(url);
    // Proxied URLs or tokens in query params
    const uParam = urlObj.searchParams.get('u') || urlObj.searchParams.get('url') || urlObj.searchParams.get('link');
    if (uParam && (uParam.toLowerCase().includes('.m3u8') || uParam.toLowerCase().includes('karwan.tv'))) return true;
    
    // Some Kurdish streams use 'hls' as a path
    if (urlObj.pathname.includes('/hls')) return true;
  } catch {
    // Fallback for non-standard URLs
  }
  
  return false;
};

const PlayerView = ({ channel, onBack, onSelectChannel, t, allChannels }: { channel: Channel, onBack: () => void, onSelectChannel: (c: Channel) => void, t: any, allChannels: Channel[] }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [canCast, setCanCast] = useState(false);



  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const isRemoteSupported = !!((video as any).remote || (video as any).webkitShowPlaybackTargetPicker);
      setCanCast(isRemoteSupported);

      if ((video as any).remote && typeof (video as any).remote.watchAvailability === 'function') {
        (video as any).remote.watchAvailability((available: boolean) => {
          if (available) setCanCast(true);
        }).catch(() => {});
      }
    }
  }, [channel.id]);

  const handleCast = async () => {
    const video = videoRef.current;
    if (!video) return;

    if ((video as any).remote) {
      try {
        await (video as any).remote.prompt();
      } catch (err: any) {
        if (err.name !== 'NotAllowedError' && !err.message?.includes('dismissed')) {
          console.error('Remote playback prompt failed', err);
        }
      }
    } else if ((video as any).webkitShowPlaybackTargetPicker) {
      (video as any).webkitShowPlaybackTargetPicker();
    }
  };

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    setError(null);
    
    if (video && channel.streamUrl) {
      const isHls = isHlsUrl(channel.streamUrl);

      if (isHls) {
        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            autoStartLoad: true,
            debug: false
          });
          
          hls.loadSource(channel.streamUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls?.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls?.recoverMediaError();
                  break;
                default:
                  setError("noStream");
                  hls?.destroy();
                  break;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = channel.streamUrl;
          video.addEventListener('loadedmetadata', () => {
            video.play().catch(() => {});
          });
        }
      } else {
        video.src = channel.streamUrl;
        video.onplay = () => setError(null);
        video.onerror = () => setError("playbackError");
      }

      return () => {
        if (hls) hls.destroy();
        video.src = '';
        video.load();
      };
    }
  }, [channel.streamUrl, refreshKey]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="fixed inset-0 z-[60] bg-brand-bg flex flex-col md:flex-row"
    >
      <div 
        className="flex-1 flex flex-col h-full bg-black relative select-none"
      >
        {/* Top Header Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 -ms-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-brand-accent focus:bg-white/15 outline-none">
              <ChevronLeft className="w-6 h-6 text-white rtl:rotate-180" />
            </button>
            <div className="flex flex-col">
              <h1 className="font-bold text-sm leading-tight line-clamp-1 text-white">{channel.name}</h1>
              <div className="flex items-center gap-1.5 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] uppercase font-black tracking-widest text-white/45">{t.liveNow}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">

            <button 
              onClick={handleCast}
              className={`p-2 rounded-full hover:bg-white/5 transition-all focus:outline-none focus:ring-4 focus:ring-brand-accent focus:bg-white/10 outline-none ${canCast ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}
              title={t.castDevice}
            >
              <Cast className="w-5 h-5 text-white animate-pulse" style={{ animationDuration: '3s' }} />
            </button>
            <button onClick={onBack} className="p-2 rounded-full hover:bg-white/5 ms-2 focus:outline-none focus:ring-4 focus:ring-brand-accent focus:bg-white/10 outline-none text-white"><X className="w-6 h-6" /></button>
          </div>
        </div>



        {/* Video Player Display */}
        <div className="flex-1 flex items-center justify-center relative group/player">

          <video 
            ref={videoRef}
            className="w-full h-full object-contain" 
            controls 
            playsInline
            autoPlay
            {...{ 
              "x-webkit-airplay": "allow",
              "disableRemotePlayback": false 
            }}
          />

          {error && (
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-6 text-center z-10">
              <MonitorPlay className="w-12 h-12 text-brand-accent animate-pulse" />
              <p className="text-sm font-medium text-white/80">{t[error] || error}</p>
              <div className="flex flex-row gap-2">
                <button 
                  onClick={() => setRefreshKey(prev => prev + 1)}
                  className="mt-2 px-6 py-2 bg-brand-accent text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-xl shadow-brand-accent/20"
                >
                  {t.reconnect}
                </button>
                <a 
                  href={channel.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 px-6 py-2 bg-yellow-500 text-black rounded-full text-xs font-bold uppercase tracking-widest shadow-xl flex items-center gap-2"
                >
                  {t.openLink}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-80 h-1/2 md:h-full bg-brand-bg border-s border-white/5 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xs font-black uppercase tracking-widest text-brand-text-muted">{t.allChannels}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
          {allChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch)}
              className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all border outline-none ${
                ch.id === channel.id 
                  ? 'bg-brand-accent/20 border-brand-accent/40 scale-[1.02]' 
                  : 'bg-brand-card/30 border-transparent hover:bg-brand-card/50'
              } focus:outline-none focus:ring-4 focus:ring-brand-accent focus:bg-brand-card/70 focus:scale-[1.02] focus:border-brand-accent/50`}
            >
              <img src={ch.logo} alt={ch.name} className="w-10 h-10 rounded-xl object-cover bg-black/20" referrerPolicy="no-referrer" />
              <div className="flex-1 text-start">
                <div className={`font-bold text-xs ${ch.id === channel.id ? 'text-brand-accent' : 'text-white'}`}>{ch.name}</div>
                <div className="text-[10px] text-brand-text-muted line-clamp-1">
                   {ch.categories.map(cat => t[`category${cat}`] || cat).join(', ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// --- Modals ---

const InfoModal = ({
  isOpen,
  onClose,
  t,
  language
}: {
  isOpen: boolean;
  onClose: () => void;
  t: any;
  language: Language;
}) => {
  const isRtl = language === 'Kurdish' || language === 'Badini' || language === 'Arabic';

  // Broadcast Alert Form States
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcDesc, setBcDesc] = useState('');
  const [bcLogo, setBcLogo] = useState('');
  const [bcSubmitting, setBcSubmitting] = useState(false);
  const [bcMessage, setBcMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const broadcastLabels = {
    English: {
      btnToggle: 'Broadcast Live Alert',
      titleLabel: 'Alert Title',
      descLabel: 'Alert Message / Instructions',
      logoLabel: 'Logo/Icon URL (Optional)',
      placeholderTitle: 'e.g. Critical Update Available!',
      placeholderDesc: 'We added dynamic channels! Reload the app to sync.',
      placeholderLogo: 'https://example.com/icon.png',
      sendBtn: 'Send Broadcast',
      sending: 'Broadcasting live...',
      success: 'Broadcast sent to all active devices!',
      errorRequired: 'Title and message are required!',
      errorServer: 'Communication error, please try again.'
    },
    Kurdish: {
      btnToggle: 'پەخشکردنی ئاگاداریی نوێ',
      titleLabel: 'ناونیشانی ئاگاداری',
      descLabel: 'ناوەرۆکی ئاگاداری / ڕێنمایی',
      logoLabel: 'بەستەری وێنە یان لۆگۆ (ئارەزوومەندانە)',
      placeholderTitle: 'بۆ نموونە: نوێکردنەوەیەکی گرنگ بەردەستە!',
      placeholderDesc: 'کەناڵی نوێ زیادکراوە! ئەپەکە دابخە و بیکەرەوە بۆ بینین.',
      placeholderLogo: 'هێڵکاری یان نیشانی وێنە',
      sendBtn: 'پەخش و بڵاوکردنەوە',
      sending: 'خەریکی پەخشکردنە...',
      success: 'ئاگاداری بۆ هەموو ئامێرەکان بەسەرکەوتوویی نێردرا!',
      errorRequired: 'تکایە هەردوو خانەکە پڕبکەرەوە!',
      errorServer: 'پەیوەندی سێرڤەر سەرکەوتوو نەبوو.'
    },
    Badini: {
      btnToggle: 'شاندنا ئاگەهداریا راستەوخۆ',
      titleLabel: 'ناڤ و نیشانێ ئاگەهداریێ',
      descLabel: 'پیام یان رێنماییێن ئاگەهداریێ',
      logoLabel: 'لینکێ وێنەیێ لۆگۆیی (ئارەزوومەندانە)',
      placeholderTitle: 'بۆ نموونە: نوژەنکرنەکا گرنگ یا بەرهەڤە!',
      placeholderDesc: 'مە کەنالێن نوێ زێدەکرینە! هیڤی دکەین ئەپی نوژەن بکەن.',
      placeholderLogo: 'لینکێ لۆگۆیی کەنالی',
      sendBtn: 'ئاگەهداریا گشتی بەلاڤکە',
      sending: 'ل هەمبەر بەلاڤکرنێ...',
      success: 'ئاگەهداریا راستەوخۆ بۆ هەمی ئامیران هاتە شاندن!',
      errorRequired: 'ناڤ و نیشان و پەیام د پێتڤینە!',
      errorServer: 'خەلەتیەک د گرێدانا سێرڤەری دا هەیە.'
    },
    Arabic: {
      btnToggle: 'بث تنبيه مباشر للمستخدمين',
      titleLabel: 'عنوان التنبيه',
      descLabel: 'نص التنبيه / التعليمات',
      logoLabel: 'رابط صورة الشعار (اختياري)',
      placeholderTitle: 'مثال: تحديث هام متاح الآن!',
      placeholderDesc: 'لقد أضفنا قنوات جديدة، يرجى تحديث التطبيق الآن.',
      placeholderLogo: 'رابط الشعار المخصص',
      sendBtn: 'بث التنبيه المباشر',
      sending: 'جاري البث المباشر...',
      success: 'تم بث التنبيه لجميع الأجهزة النشطة بنجاح!',
      errorRequired: 'العنوان والرسالة مطلوبان!',
      errorServer: 'فشل الاتصال بالخادم.'
    }
  };

  const bcl = broadcastLabels[language] || broadcastLabels.English;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-4 m-auto h-fit glass-card rounded-[40px] z-[71] p-8 max-w-sm flex flex-col gap-5 shadow-2xl border border-white/10 text-white max-h-[95vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">{t.appTitle} Hub</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
               {[
                 { icon: 'Ghost', label: 'Snapchat', sub: t.socialFollow, color: 'bg-yellow-400/20 text-yellow-500', link: 'https://www.snapchat.com/add/savan10.ten?share_id=P_WZNoKBOyw&locale=en-US' },
                 { icon: 'Music2', label: 'TikTok', sub: t.socialTikTok, color: 'bg-pink-600/20 text-pink-500', link: 'https://tiktok.com/@savaneditor' },
                 { icon: 'Youtube', label: 'YouTube', sub: t.socialYoutube, color: 'bg-red-600/20 text-red-500', link: 'https://www.youtube.com/@savan.mussicc' },
                 { icon: 'Instagram', label: 'Instagram', sub: t.socialInstagram, color: 'bg-purple-600/20 text-purple-500', link: 'https://www.instagram.com/savan.mussicc?igsh=MWx6cWZ6Z2F3eXhjaQ==' }
               ].map((social) => (
                 <a 
                   key={social.label} 
                   href={social.link}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2 hover:bg-white/10 transition-all cursor-pointer group"
                 >
                   <div className={`w-8 h-8 rounded-lg ${social.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                      {social.label === 'Snapchat' && <Ghost className="w-5 h-5" />}
                      {social.label === 'TikTok' && <Music2 className="w-5 h-5" />}
                      {social.label === 'YouTube' && <Youtube className="w-5 h-5" />}
                      {social.label === 'Instagram' && <Instagram className="w-5 h-5" />}
                   </div>
                   <div className="flex flex-col">
                     <span className="text-sm font-bold text-white line-clamp-1">{social.label}</span>
                     <span className="text-[10px] text-brand-text-muted uppercase font-bold tracking-widest">{social.sub}</span>
                   </div>
                 </a>
               ))}
            </div>

            <div className="bg-brand-accent/5 rounded-3xl p-6 border border-brand-accent/10 space-y-4">
               <p className="text-xs text-brand-text-muted text-center font-medium leading-relaxed">{t.supportMsg}</p>
               <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-center">
                  <p className="text-[10px] text-brand-accent font-black uppercase tracking-[0.2em] mb-1">FIB Account</p>
                  <p className="text-lg font-black text-white tracking-widest">{t.donorAccount}</p>
                  <p className="text-xs text-white/40 mt-1 uppercase font-bold">{t.donorName}</p>
               </div>
               <div className="w-32 h-32 mx-auto bg-white rounded-2xl p-2 flex items-center justify-center animate-none">
                  <img 
                    src="https://i.postimg.cc/J0Y5zQCz/IMG-20260518-053546.jpg" 
                    alt="FIB QR Code" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=P7AZPUOWHQFL';
                    }}
                  />
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- PWA Installation Guide Modal Removed ---
const PwaInstallModal = () => null;



const LanguageModal = ({ isOpen, onClose, onSelect, t }: { isOpen: boolean; onClose: () => void; onSelect: (l: Language) => void, t: any }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] px-4 flex items-end pb-10"
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 glass-card rounded-t-[40px] z-[71] p-8 max-w-lg mx-auto"
        >
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
          <h2 className="text-xl font-bold mb-6 text-center">{t.selectLanguage}</h2>
          <div className="space-y-3">
            {[
              { id: 'Kurdish', label: 'کوردی (S)', flag: '🇹🇯' },
              { id: 'Badini', label: 'بادینی', flag: '🇹🇯' },
              { id: 'Arabic', label: 'العربية', flag: '🇦🇪' },
              { id: 'English', label: 'English', flag: '🇬🇧' }
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => { onSelect(lang.id as Language); onClose(); }}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="text-start">
                    <div className="font-bold text-lg">{lang.label}</div>
                    <div className="text-xs text-brand-text-muted">{lang.id}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Main App ---

const TRANSLATIONS = {
  English: {
    home: 'Home',
    language: 'Language',
    search: 'Search',
    allChannels: 'All Channels',
    noChannels: 'No channels found in this category',
    noStream: 'No stream available for this channel',
    searchPlaceholder: 'Search channels...',
    supportMsg: 'You can support us by donating to this FIB account:',
    selectLang: 'Select Language',
    playbackError: 'Playback Error',
    reconnect: 'Reconnect',
    selectLanguage: 'Select Language',
    appTitle: 'AMEDI TV',
    socialFollow: 'Follow us',
    socialTikTok: 'TikTok clips',
    socialYoutube: 'YouTube channel',
    socialInstagram: 'Instagram page',
    donorName: 'Savan Amedi',
    donorAccount: 'P7AZPUOWHQFL',
    categoryAll: 'All',
    categoryKurdish: 'Kurdish',
    categoryArabic: 'Arabic',
    categoryGeneral: 'General',
    categoryNews: 'News',
    categorySports: 'Sports',
    categoryMovies: 'Movies',
    categoryRadio: 'Radio',
    categoryIslamic: 'Islamic',
    categoryKids: 'Kids',
    liveNow: 'Live Now',
    openLink: 'Open Link',
    welcomeDesc: 'Welcome to Amedi TV to watch Kurdish, international, Arabic, and sports channels live',
    initializing: 'Initializing',
    networkOnline: 'Network Online',
    initializingServer: 'Initializing Server...',
    castDevice: 'Cast to Device',
    installApp: 'Install App',
    installAppDesc: 'Install AMEDI TV on your device for a fast, immersive viewing experience.',
    installInstructions: 'To install this application on your iOS device, tap the Share button in Safari, then select "Add to Home Screen".',
    close: 'Close',
    addChannel: 'Add Channel',
    addChannelDesc: 'Add a new Kurdish or international live television channel.',
    channelName: 'Channel Name',
    streamUrl: 'Stream URL (HLS .m3u8)',
    logoUrl: 'Logo URL (Image Link)',
    selectCategories: 'Select Categories',
    adding: 'Adding...',
    addedSuccess: 'Channel added successfully!',
    validationError: 'Please fill in all fields with valid values',
    updateBannerTitle: 'Channel Updates Ready',
    updateBannerDesc: 'New channels have been added to the network. Update now to watch them!',
    updateNow: 'Update Now',
    updatingChannels: 'Syncing satellite receivers...',
    websiteUpdateTitle: 'Website Update Available',
    websiteUpdateDesc: 'An update for AMEDI TV is ready. Apply it to get the newest features and streams.',
    websiteUpdateBtn: 'Reload & Update',
    notificationSetup: 'Enable Notifications',
    notificationSetupDesc: 'Get alerts when new channels are added or critical website updates occur.',
    notificationEnabled: 'Notifications Enabled',
    notificationDisabled: 'Notifications Disabled',
    notificationAllowBtn: 'Allow Alerts',
    notificationSuccessTitle: 'Amedi TV Notifications',
    notificationSuccessDesc: 'You will now receive alerts whenever channels are added or updated!',
    systemStatus: 'System & Notifications',
    deviceModeTV: 'Smart TV Mode',
    deviceModePhone: 'Mobile Phone Mode',
    deviceModeAuto: 'Auto Optimize',
    deviceSelectorLabel: 'Screen Optimization',
    tvRemoteGuide: 'TV REMOTE SYSTEM ACTIVE: Use Arrows [↑ / ↓ / ← / →] to navigate, [Enter] to play, [Backspace/Esc] to go back.',
    phoneGestureGuide: 'Mobile Mode: Swipe left/right on player screen to quickly flip channels!',
    supportPhone: 'Telephone Support',
    supportPhoneDesc: 'For support via Phone call or WhatsApp chat, contact us directly.',
    clickToCall: 'Call Us Now',
    clickToChat: 'WhatsApp Support'
  },
  Kurdish: {
    home: 'سەرەکی',
    language: 'زمان',
    search: 'گەڕان',
    allChannels: 'هەموو کەناڵەکان',
    noChannels: 'هیچ کەناڵێک نەدۆزرایەوە لەم بەشەدا',
    noStream: 'هیچ پەخشێک بەردەست نییە بۆ ئەم کەناڵە',
    searchPlaceholder: 'بگەڕێ بۆ کەناڵەکان...',
    supportMsg: 'دەتوانیت هاوکاریمان بکەیت بە بەخشین بۆ ئەم ئەژمارەی FIB:',
    selectLang: 'زمان هەڵبژێرە',
    playbackError: 'هەڵەی پەخش',
    reconnect: 'دووبارە بەستنەوە',
    selectLanguage: 'زمان هەڵبژێرە',
    appTitle: 'ئامێدی تیڤی',
    socialFollow: 'فۆڵۆمان بکەن',
    socialTikTok: 'کلیپەکانی تیکتۆک',
    socialYoutube: 'کەناڵی یوتیوب',
    socialInstagram: 'پەیجی ئینستاگرام',
    donorName: 'ساڤان ئامێدی',
    donorAccount: 'P7AZPUOWHQFL',
    categoryAll: 'هەموو',
    categoryKurdish: 'کوردی',
    categoryArabic: 'عەرەبی',
    categoryGeneral: 'گشتی',
    categoryNews: 'هەواڵ',
    categorySports: 'وەرزش',
    categoryMovies: 'فیلم',
    categoryRadio: 'ڕادیۆ',
    categoryIslamic: 'ئیسلامی',
    categoryKids: 'منداڵان',
    liveNow: 'پەخشی ڕاستەوخۆ',
    openLink: 'کردنەوەی بەستەر',
    welcomeDesc: 'بەخێربێن بۆ ئامێدی تیڤی بۆ بینینی کەناڵە کوردی، بیانی، عەرەبی و وەرزشییەکان بە شێوازی ڕاستەوخۆ',
    initializing: 'دەستپێکردن',
    networkOnline: 'تۆڕ چالاکە',
    initializingServer: 'خەریکی ئامادەکردنی سێرڤەر...',
    castDevice: 'ئاراستەکردن بۆ ئامێر',
    installApp: 'داگرتنی ئەپەکە',
    installAppDesc: 'ئەپی ئامێدی تیڤی دابەزێنە سەر ئامێرەکەت بۆ بینینێکی خێرا و گونجاو.',
    installInstructions: 'بۆ دابەزاندنی ئەم ئەپە لەسەر ئامێری iOS (ئایفۆن)، دوگمەی Share لە Safari دابگرە، پاشان "Add to Home Screen" هەڵبژێرە.',
    close: 'داخستن',
    addChannel: 'زیادکردنی کەناڵ',
    addChannelDesc: 'کەناڵێکی تەلەفزیۆنی کوردی یان جیهانی نوێ زیاد بکە.',
    channelName: 'ناوی کەناڵ',
    streamUrl: 'بەستەری پەخش (HLS .m3u8)',
    logoUrl: 'بەستەری لۆگۆ (بەستەری وێنە)',
    selectCategories: 'هاوپۆلەکان دیاری بکە',
    adding: 'خەریکی زیادکردنە...',
    addedSuccess: 'کەناڵەکە بەسەرکەوتوویی زیادکرا!',
    validationError: 'تکایە هەموو خانەکان بە دروستی پڕبکەرەوە',
    updateBannerTitle: 'کەناڵی نوێ بەردەستە',
    updateBannerDesc: 'کەناڵی نوێ بۆ تۆڕەکە زیادکراوە. ئێستا نوێی بکەرەوە بۆ بینینیان!',
    updateNow: 'تۆڕ نوێ بکەرەوە',
    updatingChannels: 'خەریکی وەرگرتنی شەپۆلی کەناڵەکانە...',
    websiteUpdateTitle: 'نوێکردنەوەی ماڵپەڕ بەردەستە',
    websiteUpdateDesc: 'وەشانێکی نوێی ئامێدی تیڤی ئامادەیە. دایبەزێنە بۆ بەدەستهێنانی نوێترین تایبەتمەندییەکان.',
    websiteUpdateBtn: 'داگرتن و نوێکردنەوە',
    notificationSetup: 'ئاگادارکردنەوەکان چالاک بکە',
    notificationSetupDesc: 'ئاگادارکردنەوەت پێدەگات کاتێک کەناڵی نوێ یان نوێکردنەوەی ماڵپەڕ ڕوودەدات.',
    notificationEnabled: 'ئاگادارکردنەوەکان چالاککراون',
    notificationDisabled: 'ئاگادارکردنەوەکان ناچالاککراون',
    notificationAllowBtn: 'ڕێگەپێدان بە ئاگادارکردنەوە',
    notificationSuccessTitle: 'ئاگادارکردنەوەکانی ئامێدی تیڤی',
    notificationSuccessDesc: 'ئێستا ئاگادارت دەکەینەوە کاتێک کەناڵەکان زیاد دەکرێن یان نوێ دەکرێنەوە!',
    systemStatus: 'سیستەم و ئاگادارکردنەوەکان',
    deviceModeTV: 'دۆخی تەلەفزیۆنی زیرەک',
    deviceModePhone: 'دۆخی مۆبایل',
    deviceModeAuto: 'خۆکار بەستنەوە',
    deviceSelectorLabel: 'گونجاندنی شاشە',
    tvRemoteGuide: 'کۆنتڕۆڵی تەلەفزیۆن چالاکە: تیرەکان بەکاربهێنە بۆ بینینی کەناڵەکان، [Enter] بۆ لێدان، [Backspace/Esc] بۆ گەڕانەوە.',
    phoneGestureGuide: 'دۆخی مۆبایل: پەنجە بخشێنە بە لای ڕاست/چەپ لەسەر ڤیدیۆکە بۆ گۆڕینی کەناڵ!',
    supportPhone: 'پاڵپشتی تەلەفۆنی',
    supportPhoneDesc: 'بۆ پاڵپشتی لە ڕێگەی پەیوەندی تەلەفۆنی یان چاتی واتسئەپ، ڕاستەوخۆ پەیوەندیمان پێوە بکە.',
    clickToCall: 'پەیوەندی بکە',
    clickToChat: 'واتسئەپی پاڵپشتی'
  },
  Badini: {
    home: 'سەرەکی',
    language: 'زمان',
    search: 'گەڕیان',
    allChannels: 'هەمی کەناڵ',
    noChannels: 'چ کەناڵ نەهاتنە دیتن د ڤی بەشی دا',
    noStream: 'چ پەخش نینە بۆ ڤی کەناڵی',
    searchPlaceholder: 'ل کەناڵان بگەڕیێ...',
    supportMsg: 'تو دشێی پشکداریێ د پشتەڤانییا مە دا بکەی ب رێکا ڤی هەژمارا FIB:',
    selectLang: 'زمانەکێ هەلبژێرە',
    playbackError: 'خەلەتیا پەخشێ',
    reconnect: 'دوبارە گرێدان',
    selectLanguage: 'زمانەکی هەلبژێرە',
    appTitle: 'ئامێدی تیڤی',
    socialFollow: 'مە فۆڵۆ بکەن',
    socialTikTok: 'تیکتوکێ من فولو بکەن',
    socialYoutube: 'کەناڵێ یوتیوبێ',
    socialInstagram: 'پەیجێ ئینستاگرامێ',
    donorName: 'ساڤان ئامێدی',
    donorAccount: 'P7AZPUOWHQFL',
    categoryAll: 'هەمی',
    categoryKurdish: 'کوردی',
    categoryArabic: 'عەرەبی',
    categoryGeneral: 'گشتی',
    categoryNews: 'نووچە',
    categorySports: 'وەرزش',
    categoryMovies: 'فیلم',
    categoryRadio: 'ڕادیۆ',
    categoryIslamic: 'ئیسلامی',
    categoryKids: 'زارۆک',
    liveNow: 'پەخشێ ڕاستەوخۆ',
    openLink: 'ڤەکرنا لینکی',
    welcomeDesc: 'بخێر بهێن بو ئامێدی تیڤی بو بەرێ خودانا کەنالێن کوردی و بیانی و عەرەبی و وەرزشی ب شێوازێ راستەوخو',
    initializing: 'دەستپێکرن',
    networkOnline: 'تۆڕ یا کارایە',
    initializingServer: 'ل هەمبەر ئامادەکرنا سێرڤەری...',
    castDevice: 'گرێدانا ئامێری',
    installApp: 'داگرتنا ئەپی',
    installAppDesc: 'ئەپێ ئامێدی تیڤی دابەزینە سەر ئامیرێ خۆ بو دیتنەکا بلەز و تمام.',
    installInstructions: 'بۆ دابەزاندنا ڤی ئەپی ل سەر ئامیرێ iOS (ئایفۆن)، دوگمەیا Share ل Safari دابگرە، پاشان "Add to Home Screen" هەلبژێرە.',
    close: 'داخستن',
    addChannel: 'زێدەکرنا کەنالی',
    addChannelDesc: 'کەنالەکێ تەلەفزیۆنیێ کوردی یان بیانی یێ نوێ زێدە بکە.',
    channelName: 'ناڤێ کەنالی',
    streamUrl: 'لینکێ پەخشێ (HLS .m3u8)',
    logoUrl: 'لینکێ لۆگۆیی (لینکێ وێنەی)',
    selectCategories: 'فۆڵدەر و هۆپۆلان دەستنیشان بکە',
    adding: 'خەریکە زێدە دکەت...',
    addedSuccess: 'کەنال ب سەرکەفتیانە هاتە زێدەکرن!',
    validationError: 'هیڤی دکەین هەمی خانەیان ب دروستی پر بکەن',
    updateBannerTitle: 'کەنالێن نوێ بەرهەڤن',
    updateBannerDesc: 'کەنالێن د نوێ بۆ تورا مە هاتینە زێدەکرن. نوکە نوژەن بکە بۆ دیتنێ!',
    updateNow: 'نوکە نوژەن بکە',
    updatingChannels: 'خەریکە کەنالێن نوێ وەردگریت...',
    websiteUpdateTitle: 'نووکرنا مالپەری بەرهەڤە',
    websiteUpdateDesc: 'وەشانەکێ نوێ یێ ئامێدی تیڤی ب دەست کەفت. نوکە نوژەن بکە بۆ دیتنا تایبەتمەندیێن نوێ.',
    websiteUpdateBtn: 'نووکرن و دووبارە بارکرن',
    notificationSetup: 'ئاگەدارکرنان چالاک بکە',
    notificationSetupDesc: 'ئاگەدارکرن بۆ تە دێ هێن کاتێ کەنالێن نوێ یان نوژەنکرنێن مالپەری دبن.',
    notificationEnabled: 'ئاگەدارکرن هاتنە چالاککرن',
    notificationDisabled: 'ئاگەدارکرن هاتنە ناچالاککرن',
    notificationAllowBtn: 'رێگە پێدان پێ بکە',
    notificationSuccessTitle: 'ئاگەدارکرنێن ئامێدی تیڤی',
    notificationSuccessDesc: 'نوکە م دێ تە ئاگەدار کەین دەما کەنالێن نوێ زێدە دبن یان دهێنە نوژەنکرن!',
    systemStatus: 'سیستەم و ئاگەدارکرن',
    deviceModeTV: 'شێوازێ تەلەفزیۆنێ',
    deviceModePhone: 'شێوازێ موبایلێ',
    deviceModeAuto: 'سیستەمێ خۆکار',
    deviceSelectorLabel: 'رێکخستنا شاشێ',
    tvRemoteGuide: 'کۆنترۆلا تیڤیێ یا چاڵاکە: دوگمەیێن ئاراستە بۆ تەماشاکرنێ، [Enter] بۆ لێدانێ، [Backspace/Esc] بۆ زڤرینێ.',
    phoneGestureGuide: 'شێوازێ موبایلێ: دەستێ خۆ بکێشە ل سەر ڤیدیۆیێ بۆ گۆڕینا کەنالان!',
    supportPhone: 'پشتەڤانیا تەلەفۆنێ',
    supportPhoneDesc: 'بۆ پشتەڤانیێ ب ڕێکارێن پەیوەندیا تەلەفۆنی یان کۆمێن واتسئەپ، ڕاستەوخۆ پەیوەندیێ مە بکە.',
    clickToCall: 'پەیوەندیێ بکە',
    clickToChat: 'واتسئەپا پشتەڤانیێ'
  },
  Arabic: {
    home: 'الرئيسية',
    language: 'اللغة',
    search: 'بحث',
    allChannels: 'جميع القنوات',
    noChannels: 'لم يتم العثور على قنوات في هذه الفئة',
    noStream: 'لا يوجد بث متاح لهذه القناة',
    searchPlaceholder: 'ابحث عن القنوات...',
    supportMsg: 'يمكنك دعمنا من خلال التبرع لحساب FIB التالي:',
    selectLang: 'اختر اللغة',
    playbackError: 'خطأ في التشغيل',
    reconnect: 'إعادة الاتصال',
    selectLanguage: 'اختر اللغة',
    appTitle: 'أميدي تي في',
    socialFollow: 'تابعنا',
    socialTikTok: 'مقاطع تيك توك',
    socialYoutube: 'قناة اليوتيوب',
    socialInstagram: 'صفحة الإنستغرام',
    donorName: 'سافان أميدي',
    donorAccount: 'P7AZPUOWHQFL',
    categoryAll: 'الكل',
    categoryKurdish: 'كردي',
    categoryArabic: 'عربي',
    categoryGeneral: 'عام',
    categoryNews: 'أخبار',
    categorySports: 'رياضة',
    categoryMovies: 'أفلام',
    categoryRadio: 'راديو',
    categoryIslamic: 'إسلامي',
    categoryKids: 'أطفال',
    liveNow: 'بث مباشر',
    openLink: 'فتح الرابط',
    welcomeDesc: 'أهلاً بكم في أميدي تي في لمشاهدة القنوات الكردية والعالمية العربية والرياضية بثاً مباشرًا',
    initializing: 'جاري التحضير',
    networkOnline: 'الشبكة متصلة',
    initializingServer: 'جاري تهيئة الخادم...',
    castDevice: 'البث إلى جهاز',
    installApp: 'تثبيت التطبيق',
    installAppDesc: 'قم بتثبيت تطبيق أميدي تي في على جهازك لتجربة مشاهدة سريعة وبملء الشاشة.',
    installInstructions: 'لتثبيت هذا التطبيق على جهاز iOS الخاص بك، اضغط على زر المشاركة في Safari، ثم اختر "إضافة إلى الشاشة الرئيسية".',
    close: 'إغلاق',
    addChannel: 'إضافة قناة',
    addChannelDesc: 'إضافة قناة تلفزيونية كردية أو عالمية جديدة للبث المباشر.',
    channelName: 'اسم القناة',
    streamUrl: 'رابط البث (HLS .m3u8)',
    logoUrl: 'رابط الشعار (رابط صورة)',
    selectCategories: 'اختر التصنيفات',
    adding: 'جاري الإضافة...',
    addedSuccess: 'تم إضافة القناة بنجاح!',
    validationError: 'يرجى ملء جميع الحقول بشكل صحيح',
    updateBannerTitle: 'تحديث قنوات جديد متاح',
    updateBannerDesc: 'تمت إضافة قنوات جديدة إلى الشبكة. حدث الآن لمشاهدتها!',
    updateNow: 'تحديث القنوات',
    updatingChannels: 'جاري جلب القنوات الجديدة وتحديث البث...',
    websiteUpdateTitle: 'تحديث الموقع متاح',
    websiteUpdateDesc: 'هناك تحديث جديد لموقع أميدي تي في. يرجى التحديث للحصول على أحدث الميزات والبث.',
    websiteUpdateBtn: 'تحديث وإعادة التحميل',
    notificationSetup: 'تفعيل الإشعارات',
    notificationSetupDesc: 'احصل على تنبيهات فورية عند إضافة قنوات جديدة أو تحديثات هامة للموقع.',
    notificationEnabled: 'الإشعارات مفعلة',
    notificationDisabled: 'الإشعارات معطلة',
    notificationAllowBtn: 'السماح بالتنبيهات',
    notificationSuccessTitle: 'إشعارات أميدي تي في',
    notificationSuccessDesc: 'ستتلقى الآن تنبيهات عندما يتم إضافة قنوات جديدة أو تحديثها!',
    systemStatus: 'النظام والإشعارات',
    deviceModeTV: 'وضع التلفاز الذكي',
    deviceModePhone: 'وضع الهاتف المحمول',
    deviceModeAuto: 'تحديد تلقائي',
    deviceSelectorLabel: 'تحسين العرض',
    tvRemoteGuide: 'وضع التلفاز نشط: استخدم الأسهم للتنقل بين القنوات، [Enter] للتشغيل، [Backspace/Esc] للرجوع.',
    phoneGestureGuide: 'وضع الهاتف: اسحب يميناً أو يساراً لتغيير القنوات بسهولة!',
    supportPhone: 'الدعم الهاتفي',
    supportPhoneDesc: 'للحصول على الدعم عبر مكالمة هاتفية أو واتساب، تواصل معنا مباشرة.',
    clickToCall: 'اتصل بنا الآن',
    clickToChat: 'دعم واتساب'
  }
};

// --- Splash Screen Logo Loader ---
const SplashScreen = ({ t }: { t: any; key?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-[#0f0a1e] flex flex-col items-center justify-center p-6 select-none"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Glow ambient background sphere */}
        <div className="absolute inset-x-0 top-1/4 bottom-1/4 m-auto w-64 h-64 bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />

        {/* Animated logo container */}
        <motion.div
          initial={{ scale: 0.75, opacity: 0, rotate: -5 }}
          animate={{ scale: [0.75, 1.05, 1], opacity: 1, rotate: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-32 h-32 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(147,51,234,0.25)] border border-white/10 p-1 bg-[#1a1433] flex items-center justify-center relative z-10"
        >
          <img 
            src="https://i.postimg.cc/QxGcmFd3/file-0000000004b47246b78b315ac6479e1d.png" 
            alt="AMEDI TV Logo" 
            className="w-full h-full object-cover rounded-2xl" 
            referrerPolicy="no-referrer" 
          />
        </motion.div>

        {/* Text and Branding animations */}
        <div className="text-center relative z-10">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none"
          >
            AMEDI <span className="text-brand-accent">TV</span>
          </motion.h1>
          
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "80px" }}
            transition={{ delay: 0.6, duration: 0.8, ease: "easeInOut" }}
            className="h-[3px] bg-gradient-to-r from-transparent via-purple-600 to-transparent mx-auto mt-3 rounded-full"
          />

          <motion.p
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 0.7 }}
            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
            className="text-xs md:text-sm font-semibold text-slate-300 mt-4 max-w-sm md:max-w-md mx-auto leading-relaxed px-4 text-center"
          >
            {t.welcomeDesc}
          </motion.p>
        </div>

        {/* Linear Loading Progress */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="mt-8 flex flex-col items-center gap-3 relative z-10"
        >
          <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <motion.div 
              className="h-full bg-purple-600 rounded-full"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              style={{ width: "50%" }}
            />
          </div>
          <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/30">{t.initializing}</span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('language');
      if (saved === 'Kurdish' || saved === 'Arabic' || saved === 'English' || saved === 'Badini') {
        return saved as Language;
      }
    } catch (e) {
      console.warn("localStorage is blocked or unavailable:", e);
    }
    return 'Badini';
  });

  const t = TRANSLATIONS[language];

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const triggerNotification = (title: string, body: string, iconUrl?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const icon = iconUrl || 'https://i.postimg.cc/QxGcmFd3/file-0000000004b47246b78b315ac6479e1d.png';
      
      // Prioritize Service Worker registration's showNotification (more robust on mobile & PWAs)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon,
            badge: icon,
            vibrate: [100, 50, 100],
            data: { url: window.location.origin }
          } as any).catch(err => {
            console.warn("Failed standard SW notification, falling back to constructor:", err);
            try {
              new Notification(title, { body, icon });
            } catch (fallbackErr) {
              console.error("All notification methods failed:", fallbackErr);
            }
          });
        }).catch(() => {
          // Fallback if service worker ready fails
          try {
            new Notification(title, { body, icon });
          } catch (e) {
            console.error("Failed notification constructor:", e);
          }
        });
      } else {
        // Direct constructor fallback if service worker is not supported
        try {
          new Notification(title, { body, icon });
        } catch (e) {
          console.error("Failed notification constructor fallback:", e);
        }
      }
    }
  };

  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  
  const [liveAnnouncement, setLiveAnnouncement] = useState<{ title: string; desc: string; logo?: string } | null>(null);

  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'All' || c.categories.includes(category);
      return matchesSearch && matchesCategory;
    });
  }, [search, category, channels]);

  // Real-time Update Stream Listener (Server-Sent Events)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const eventSource = new EventSource('/api/updates/stream');

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Live updates connection established successfully!');
    });

    const handleChannelUpdate = (event: MessageEvent, isEdit: boolean) => {
      try {
        const data = JSON.parse(event.data);
        if (data.version) {
          setCurrentVersion(data.version);
        }

        if (data.channel) {
          const chName = data.channel.name;
          const chLogo = data.channel.logo;

          // Local state hot update - updates the active listing immediately
          setChannels(prev => {
            const index = prev.findIndex(c => c.name.toLowerCase() === chName.toLowerCase());
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = data.channel;
              return updated;
            } else {
              return [...prev, data.channel];
            }
          });

          // Compile localized notification banners with explicit update instructions
          let title = '';
          let desc = '';
          switch (language) {
            case 'Kurdish':
              title = isEdit ? 'کەناڵی تەلەفزیۆنی نوێکرایەوە!' : 'کەناڵێکی نوێ زیادکرا!';
              desc = `«${chName}» بەردەستە لەسەر ئامێدی تیڤی! تکایە ئەپەکە نوێ بکەرەوە بۆ تەماشاکردن.`;
              break;
            case 'Badini':
              title = isEdit ? 'کەنال هاتە نوژەنکرن!' : 'کەنالەک د نوێ هاتە زێدەکرن!';
              desc = `«${chName}» یا بەرهەڤە ل سەر ئامێدی تیڤی! هیڤی دکەین ئەپی نوژەن بکەی بۆ دیتنێ.`;
              break;
            case 'Arabic':
              title = isEdit ? 'تم تحديث القناة!' : 'تم إضافة قناة جديدة!';
              desc = `«${chName}» متاحة الآن على أميدي تي في! يرجى تحديث التطبيق لمشاهدتها.`;
              break;
            default:
              title = isEdit ? 'Channel Updated!' : 'New Channel Added!';
              desc = `«${chName}» is now available on AMEDI TV! Please update the app to watch.`;
              break;
          }

          // Trigger System Notification
          triggerNotification(title, desc, chLogo);

          // Update Live Overlay banner
          setLiveAnnouncement({ title, desc, logo: chLogo });
        }
      } catch (err) {
        console.error('[SSE] Error processing update payload:', err);
      }
    };

    const onAdded = (e: MessageEvent) => handleChannelUpdate(e, false);
    const onUpdated = (e: MessageEvent) => handleChannelUpdate(e, true);
    const onCustomAnnouncement = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.title && data.desc) {
          triggerNotification(data.title, data.desc, data.logo);
          setLiveAnnouncement({ title: data.title, desc: data.desc, logo: data.logo });
        }
      } catch (err) {
        console.error('[SSE] Error processing custom-announcement:', err);
      }
    };

    eventSource.addEventListener('channel-added', onAdded as any);
    eventSource.addEventListener('channel-updated', onUpdated as any);
    eventSource.addEventListener('custom-announcement', onCustomAnnouncement as any);

    return () => {
      eventSource.removeEventListener('channel-added', onAdded as any);
      eventSource.removeEventListener('channel-updated', onUpdated as any);
      eventSource.removeEventListener('custom-announcement', onCustomAnnouncement as any);
      eventSource.close();
    };
  }, [language, currentVersion]);

  // Clear announcement after 6 seconds if active
  useEffect(() => {
    if (!liveAnnouncement) return;
    const timer = setTimeout(() => {
      setLiveAnnouncement(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [liveAnnouncement]);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const isRtl = language === 'Kurdish' || language === 'Badini' || language === 'Arabic';
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchClick = () => {
    setSelectedChannel(null);
    setCategory('All');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  };

  // Global Escape key close modal handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedChannel) {
          setSelectedChannel(null);
        } else if (langModalOpen) {
          setLangModalOpen(false);
        } else if (infoModalOpen) {
          setInfoModalOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedChannel, langModalOpen, infoModalOpen]);

  useEffect(() => {
    let minTimeElapsed = false;
    let dataLoaded = false;

    const timer = setTimeout(() => {
      minTimeElapsed = true;
      if (dataLoaded) {
        setShowSplash(false);
      }
    }, 2800);

    async function loadData() {
      try {
        const response = await fetch('/api/channels');
        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels || CHANNELS);
          setCategories(data.categories || CATEGORIES);
          if (data.version) {
            setCurrentVersion(data.version);
          }
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error: any) {
        // Safe robust offline/restart local fallback
        if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
          console.debug('Failed to fetch channels, falling back to local list');
        } else {
          console.warn('Failed to load channels from API:', error?.message || error);
        }
        setChannels(CHANNELS);
        setCategories(CATEGORIES);
      } finally {
        setLoading(false);
        dataLoaded = true;
        if (minTimeElapsed) {
          setShowSplash(false);
        }
      }
    }
    loadData();

    return () => clearTimeout(timer);
  }, []);

  // Sync / update channels from the server
  const updateChannels = async (silent = false) => {
    if (!silent) {
      setIsSyncing(true);
    }
    try {
      const response = await fetch('/api/channels');
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels);
        if (data.categories) {
          setCategories(data.categories);
        }
        if (data.version) {
          setCurrentVersion(data.version);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e: any) {
      if (e?.name === 'TypeError' && e?.message?.includes('fetch')) {
        console.debug('Failed to sync channels (server is offline or restarting)');
      } else {
        console.warn('Silent channel sync failure:', e?.message || e);
      }
    } finally {
      if (!silent) {
        setTimeout(() => {
          setIsSyncing(false);
        }, 1200);
      }
    }
  };

  // Check for updates periodically in the background
  const checkUpdate = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    try {
      const response = await fetch('/api/channels/version');
      if (response.ok) {
        const data = await response.json();
        if (data.version && currentVersion && data.version !== currentVersion) {
          setCurrentVersion(data.version);
          updateChannels(true); // Silent sync in the background
          return true;
        }
      }
    } catch (e: any) {
      if (e?.name === 'TypeError' && e?.message?.includes('fetch')) {
        console.debug('Could not check channel list version heartbeat (offline or server restart)');
      } else {
        console.warn('Could not check channel list version:', e?.message || e);
      }
    }
    return false;
  };

  useEffect(() => {
    if (loading || showSplash) return;

    const runCheck = () => {
      checkUpdate();
    };

    // Check version every 30 seconds for optimal background performance
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, [currentVersion, loading, showSplash, language]);





  const availableCategories = useMemo(() => {
    const used = new Set<Category>(['All']);
    channels.forEach(c => c.categories.forEach(cat => used.add(cat)));
    return categories.filter(cat => used.has(cat));
  }, [channels, categories]);

  if (loading && !showSplash) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
          <p className="font-bold uppercase tracking-widest text-xs opacity-50">{t.initializingServer}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen pb-24 relative bg-brand-bg overflow-x-hidden selection:bg-brand-accent/30">
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash-screen" t={t} />}
      </AnimatePresence>
      {/* App Header */}
      <header className="max-w-6xl mx-auto px-4 pt-10 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-brand-accent/20 rotate-3 border border-white/10 bg-brand-card">
            <img 
              src="https://i.postimg.cc/QxGcmFd3/file-0000000004b47246b78b315ac6479e1d.png" 
              alt="AMEDI TV Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none">AMEDI <span className="text-brand-accent">TV</span></h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{t.networkOnline}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setInfoModalOpen(true)}
            className="p-3 rounded-full bg-white/5 text-white/40 hover:text-white transition-all focus:outline-none focus:ring-4 focus:ring-brand-accent outline-none"
          >
             <Info className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto">
        <SearchBar 
          value={search} 
          onChange={setSearch} 
          placeholder={t.searchPlaceholder} 
          inputRef={searchInputRef}
        />
        
        <div className="overflow-x-auto no-scrollbar px-4 flex gap-2 pb-4">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap outline-none ${
                category === cat
                  ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 scale-105'
                  : 'bg-brand-card/50 text-brand-text-muted hover:bg-brand-card/80'
              } focus:outline-none focus:ring-4 focus:ring-brand-accent/50 focus:scale-105`}
            >
              {t[`category${cat}`] || cat}
            </button>
          ))}
        </div>

        <main className="px-4 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {filteredChannels.map((channel: Channel) => (
              <ChannelCard 
                key={channel.id} 
                name={channel.name} 
                logo={channel.logo} 
                onClick={() => setSelectedChannel(channel)}
              />
            ))}
          </div>
          
          {filteredChannels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-brand-text-muted">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>{t.noChannels}</p>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 h-20 glass-card rounded-[32px] flex items-center justify-around px-8 z-40 w-[90%] max-w-md border border-white/10 shadow-2xl ring-1 ring-white/5 ${language === 'Arabic' || language === 'Kurdish' || language === 'Badini' ? 'flex-row-reverse' : 'flex-row'}`}>
        <button 
           onClick={() => { setCategory('All'); setSearch(''); setSelectedChannel(null); }}
           className={`flex flex-col items-center gap-1 transition-all focus:outline-none focus:text-brand-accent focus:scale-110 duration-150 outline-none ${category === 'All' && !search && !selectedChannel ? 'text-brand-accent' : 'text-white/40 hover:text-white'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{t.home}</span>
        </button>
        
        <button 
          onClick={handleSearchClick}
          className="relative group focus:outline-none focus:scale-105 duration-150 outline-none"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-accent via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-brand-accent/40 -translate-y-8 border-8 border-brand-bg relative z-50 group-hover:scale-110 transition-transform active:scale-95 group-focus:scale-110 group-focus:ring-4 group-focus:ring-brand-accent/50">
            <Search className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
          <div className="absolute inset-0 bg-brand-accent/30 blur-2xl rounded-full -translate-y-8 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <button 
          onClick={() => setLangModalOpen(true)}
          className="flex flex-col items-center gap-1 text-white/40 hover:text-white focus:outline-none focus:text-brand-accent focus:scale-110 duration-150 outline-none transition-all"
        >
          <Globe className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{t.language}</span>
        </button>
      </nav>

      <AnimatePresence>
        {selectedChannel && (
          <PlayerView 
            channel={selectedChannel} 
            onBack={() => setSelectedChannel(null)} 
            onSelectChannel={setSelectedChannel}
            t={t}
            allChannels={channels}
          />
        )}
      </AnimatePresence>

      <LanguageModal 
        isOpen={langModalOpen} 
        onClose={() => setLangModalOpen(false)} 
        onSelect={(lang) => {
          setLanguage(lang);
          try {
            localStorage.setItem('language', lang);
          } catch (e) {
            console.warn("localStorage is blocked or unavailable:", e);
          }
        }}
        t={t}
      />

      <InfoModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        t={t}
        language={language}
      />

      {/* Live Channels Real-time Hot Notification Banner */}
      <AnimatePresence>
        {liveAnnouncement && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 right-6 left-6 md:left-auto md:max-w-md bg-brand-card/95 backdrop-blur-xl border border-pink-500/30 rounded-[30px] p-5 shadow-2xl z-[99] flex items-center gap-4 text-white"
          >
            {liveAnnouncement.logo && (
              <div className="w-12 h-12 rounded-[18px] overflow-hidden bg-black/40 p-0.5 border border-white/10 shrink-0">
                <img src={liveAnnouncement.logo} alt="Channel Logo" className="w-full h-full object-cover rounded-[14px]" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="flex-1 text-left">
              <h4 className="text-xs font-black text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>{liveAnnouncement.title}</span>
              </h4>
              <p className="text-[11px] text-white/90 mt-1 leading-normal font-medium">{liveAnnouncement.desc}</p>
            </div>
            <button 
              onClick={() => setLiveAnnouncement(null)} 
              className="p-1.5 rounded-full hover:bg-white/5 text-white/40 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Syncing Overlay */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white"
          >
            <RefreshCw className="w-12 h-12 text-brand-accent animate-spin" />
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-bold uppercase tracking-[0.25em] text-xs text-brand-accent/90"
            >
              {t.updatingChannels}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
