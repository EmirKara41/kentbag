import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  LayoutDashboard,
  Inbox,
  Map,
  Megaphone,
  HardHat,
  UsersRound,
  Search,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  X,
  Plus,
  Download,
  Clock3,
  MapPin,
  Bell,
  Check,
  CircleCheck,
  Droplets,
  Zap,
  Trash2,
  Construction,
  Snowflake,
  Accessibility,
  Trees,
  Lightbulb,
  SlidersHorizontal,
  RotateCcw,
  Info,
  Waypoints,
  PanelLeftClose,
  Send,
  LockKeyhole,
  Link2,
  History,
  ExternalLink,
  HeartHandshake,
} from "lucide-react";
import {
  categories,
  needsReview,
  priorities,
  statuses,
  type Category,
  type CitizenReport,
} from "./domain";
const icons = {
  overview: LayoutDashboard,
  inbox: Inbox,
  map: Map,
  announce: Megaphone,
  work: HardHat,
  team: UsersRound,
  search: Search,
  arrow: ArrowRight,
  up: ArrowUpRight,
  chevron: ChevronRight,
  close: X,
  plus: Plus,
  download: Download,
  clock: Clock3,
  pin: MapPin,
  bell: Bell,
  check: Check,
  done: CircleCheck,
  water: Droplets,
  zap: Zap,
  trash: Trash2,
  road: Construction,
  snow: Snowflake,
  accessibility: Accessibility,
  tree: Trees,
  light: Lightbulb,
  filter: SlidersHorizontal,
  reset: RotateCcw,
  info: Info,
  brand: Waypoints,
  menu: PanelLeftClose,
  send: Send,
  lock: LockKeyhole,
  link: Link2,
  history: History,
  external: ExternalLink,
  support: HeartHandshake,
};
export type IconName = keyof typeof icons;
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const Component = icons[name as IconName] ?? Inbox;
  return <Component size={size} strokeWidth={1.7} aria-hidden />;
}
export function CategoryIcon({
  category,
  small = false,
}: {
  category: Category;
  small?: boolean;
}) {
  return (
    <span
      className={`category-icon ${categories[category].color} ${small ? "small" : ""}`}
    >
      <Icon name={categories[category].icon} size={small ? 17 : 22} />
    </span>
  );
}
export function StatusBadge({ report }: { report: CitizenReport }) {
  return (
    <span
      className={`status-badge ${needsReview(report) ? "persists" : report.status}`}
    >
      <i />
      {needsReview(report)
        ? "Yeniden inceleme gerekli"
        : statuses[report.status]}
    </span>
  );
}
export function PriorityBadge({ report }: { report: CitizenReport }) {
  return (
    <span className={`priority-badge ${report.priority}`}>
      <i />
      {priorities[report.priority]}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </div>
  );
}
export function Button({
  children,
  icon,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      className={`button ${variant}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
export function Message({ children }: { children: ReactNode }) {
  return (
    <div className="message" role="alert">
      <Icon name="info" size={17} />
      <span>{children}</span>
    </div>
  );
}
export function Empty({
  title = "Bu görünümde kayıt yok.",
  body = "Filtreleri değiştirerek diğer kayıtlara bakabilirsin.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="empty">
      <span>
        <Icon name="inbox" size={29} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "modal drawer" : "modal"}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">KENTBAĞ · ÖRNEK ÇALIŞMA ALANI</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Pencereyi kapat"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
