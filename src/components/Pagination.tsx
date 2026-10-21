import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
}

const pageButtonClassName =
    "rounded-md p-1.5 text-mute-400 transition hover:bg-ink-700 hover:text-mute-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-mute-400";

/** Renders nothing while every row fits on one page. */
export default function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
    if (pageCount <= 1) {
        return null;
    }
    return (
        <nav
            aria-label="Pagination"
            className="flex items-center justify-center gap-3 border-t border-ink-750 px-3 py-2 font-mono text-[11px] text-mute-400"
        >
            <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                title="Previous page"
                className={pageButtonClassName}
            >
                <ChevronLeft size={14} />
            </button>
            <span>
                Page {page} of {pageCount}
            </span>
            <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pageCount}
                aria-label="Next page"
                title="Next page"
                className={pageButtonClassName}
            >
                <ChevronRight size={14} />
            </button>
        </nav>
    );
}
