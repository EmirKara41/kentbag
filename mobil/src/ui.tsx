import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Camera,
  CircleHelp,
  FileText,
  Home,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Snowflake,
  Trash2,
  UserRound,
  X,
  Zap,
  Droplets,
  Construction,
  ImagePlus,
  LogOut,
  Pencil,
  WifiOff,
  ChevronDown,
  LoaderCircle,
  Search,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  Info,
  Building2,
  LocateFixed,
  Download,
  Accessibility,
  Trees,
  HeartHandshake,
} from "lucide-react";
const icons = {
  back: ArrowLeft,
  arrow: ArrowRight,
  bell: Bell,
  check: Check,
  done: CheckCircle2,
  chevron: ChevronRight,
  clock: Clock3,
  camera: Camera,
  help: CircleHelp,
  file: FileText,
  home: Home,
  pin: MapPin,
  navigation: Navigation,
  plus: Plus,
  refresh: RefreshCw,
  send: Send,
  shield: ShieldCheck,
  snow: Snowflake,
  trash: Trash2,
  user: UserRound,
  close: X,
  zap: Zap,
  droplet: Droplets,
  road: Construction,
  gallery: ImagePlus,
  logout: LogOut,
  edit: Pencil,
  offline: WifiOff,
  down: ChevronDown,
  loading: LoaderCircle,
  search: Search,
  mail: Mail,
  lock: LockKeyhole,
  eye: Eye,
  hidden: EyeOff,
  info: Info,
  building: Building2,
  locate: LocateFixed,
  download: Download,
  accessibility: Accessibility,
  tree: Trees,
  support: HeartHandshake,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 22,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const Component = icons[name as IconName] || FileText;
  return (
    <Component
      aria-hidden
      size={size}
      strokeWidth={1.8}
      className={className}
      style={style}
    />
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Building2 size={23} strokeWidth={1.8} />
      </span>
      {!compact && (
        <span>
          Kent<span className="brand-light">Yanımda</span>
          <small>YAŞADIĞIN YER İÇİN</small>
        </span>
      )}
    </div>
  );
}
export function Button({
  children,
  onClick,
  variant = "primary",
  busy = false,
  disabled = false,
  icon,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`button ${variant} ${className}`}
      aria-busy={busy}
    >
      {busy ? (
        <Icon name="loading" className="spin" size={19} />
      ) : icon ? (
        <Icon name={icon} size={19} />
      ) : null}
      {children}
    </button>
  );
}
export function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`message ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <Icon name={error ? "info" : "shield"} size={19} />
      <span>{children}</span>
    </div>
  );
}
export function Empty({
  icon = "file",
  title,
  body,
  children,
}: {
  icon?: IconName;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={31} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Sheet({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sheet ${wide ? "photo-sheet" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-grip" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Kapat"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
export function CityArt() {
  return (
    <svg
      className="city-art"
      viewBox="0 0 180 160"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="109" cy="71" r="62" fill="#ffffff" fillOpacity=".08" />
      <circle cx="136" cy="35" r="15" fill="#AED9FF" />
      <path
        d="M12 133h157M28 149h119"
        stroke="#88BCFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M23 132V84l29-18 27 18v48" fill="#A8CFFF" />
      <path d="M53 132V45h43v87" fill="#E0EEFF" />
      <path d="M96 132V68h47v64" fill="#7EB0F5" />
      <path
        d="M62 56h7v10h-7zm17 0h7v10h-7zM62 77h7v10h-7zm17 0h7v10h-7zM62 99h7v10h-7zm17 0h7v10h-7z"
        fill="#4385DC"
      />
      <path
        d="M107 80h8v10h-8zm16 0h8v10h-8zm-16 21h8v10h-8zm16 0h8v10h-8z"
        fill="#DDEEFF"
      />
      <path d="M72 132v-14h9v14M36 94h9v12h-9" fill="#3064A8" />
      <path d="M152 131v-25" stroke="#DAEAFF" strokeWidth="3" />
      <ellipse cx="152" cy="97" rx="13" ry="17" fill="#A7D9BA" />
      <path d="M14 131v-19" stroke="#DAEAFF" strokeWidth="3" />
      <ellipse cx="14" cy="105" rx="10" ry="13" fill="#B9D9A9" />
      <path
        d="M99 25c0-12-17-12-17 0 0 8 8.5 16 8.5 16S99 33 99 25Z"
        fill="#FFD17E"
      />
      <circle cx="90.5" cy="24" r="3.5" fill="#D49A3C" />
    </svg>
  );
}
