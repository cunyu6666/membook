import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { BookReader } from "../../components/pages/BookReader";
import type { BookDraft } from "../../lib/types";
import type { Locale } from "../../lib/i18n";

export function BookReaderPage() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [locale] = useState<Locale>(() => (localStorage.getItem("membook.locale") as Locale) || "zh");
  const [book, setBook] = useState<BookDraft | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("membook.history");
      if (!raw) return;
      const items = JSON.parse(raw) as Array<{ id: string; bookDraft: BookDraft | null }>;
      const found = items.find((i) => i.id === bookId);
      if (found?.bookDraft) setBook(found.bookDraft);
    } catch { /* ignore */ }
  }, [bookId]);

  if (!book) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/42 backdrop-blur-xl">
        <Card className="p-8 text-center">
          <p className="text-lg font-bold">{locale === "zh" ? "未找到这本书" : "Book not found"}</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            {locale === "zh" ? "返回工作台" : "Back to studio"}
          </Button>
        </Card>
      </div>
    );
  }

  return <BookReader book={book} locale={locale} onClose={() => navigate("/studio")} />;
}
