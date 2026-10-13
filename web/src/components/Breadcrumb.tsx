import { Library } from "lucide-react";

export function Breadcrumb({ path }: { path: string }) {
  const [library, ...parts] = path.split("/");
  return (
    <nav className="breadcrumb" aria-label="Caminho na biblioteca">
      <span className="breadcrumb-crumb" title="Biblioteca">
        <Library size={12} aria-hidden="true" />
        {library}
      </span>
      {parts.map((part, i) => (
        <span key={`${i}-${part}`} style={{ display: "contents" }}>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <span className={`breadcrumb-crumb ${i === parts.length - 1 ? "current" : ""}`} aria-current={i === parts.length - 1 ? "page" : undefined}>
            {part}
          </span>
        </span>
      ))}
    </nav>
  );
}
