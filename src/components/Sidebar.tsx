import { 
  BarChart2, 
  Image as ImageIcon, 
  Settings, 
  Sparkles,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activePage: 'dashboard' | 'pngtree';
  setActivePage: (page: 'dashboard' | 'pngtree') => void;
  setShowSettings: (show: boolean) => void;
  open: () => void;
  openPngTree: () => void;
}

export function Sidebar({ 
  activePage, 
  setActivePage, 
  setShowSettings,
  open,
  openPngTree
}: SidebarProps) {
  return (
    <>
      {/* Sidebar Desktop */}
      <div className="hidden md:flex w-20 bg-white border-r border-slate-200 flex-col items-center py-6 gap-8 z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mb-2">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex flex-col gap-4 flex-1">
          <button 
            onClick={() => setActivePage('dashboard')}
            className={cn(
              "p-4 rounded-2xl transition-all relative group",
              activePage === 'dashboard' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
            title="Dashboard"
            id="sidebar-btn-dashboard"
          >
            <BarChart2 className="w-6 h-6" />
            {activePage === 'dashboard' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-l-full" />}
          </button>

          <button 
            onClick={() => setActivePage('pngtree')}
            className={cn(
              "p-4 rounded-2xl transition-all relative group",
              activePage === 'pngtree' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
            title="PNGTree Pro Page"
            id="sidebar-btn-pngtree"
          >
            <ImageIcon className="w-6 h-6" />
            {activePage === 'pngtree' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-l-full" />}
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-4 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Settings"
            id="sidebar-btn-settings"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Navigation Mobile (Bottom Bar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around px-6 z-[100] pb-safe">
        <button 
          onClick={() => setActivePage('dashboard')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activePage === 'dashboard' ? "text-indigo-600" : "text-slate-400"
          )}
          id="mobile-nav-dashboard"
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Dash</span>
        </button>
        
        <div 
          onClick={() => {
            if (activePage === 'dashboard') open();
            else openPngTree();
          }}
          className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 -mt-8 border-4 border-slate-50 transition-transform active:scale-95"
          id="mobile-nav-plus"
        >
          <Plus className="w-6 h-6 text-white" />
        </div>

        <button 
          onClick={() => setActivePage('pngtree')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activePage === 'pngtree' ? "text-indigo-600" : "text-slate-400"
          )}
          id="mobile-nav-pngtree"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-widest">PNGTree</span>
        </button>
      </div>
    </>
  );
}
