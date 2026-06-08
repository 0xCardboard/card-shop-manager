import SubmitOnChange from "./SubmitOnChange";

type Select = {
  name: string;
  value: string;
  options: { value: string; label: string }[];
};

// A GET form for searching/filtering a list page. The text box submits on
// Enter or via the Search button; selects auto-submit on change. Everything is
// driven through URL search params so results are bookmarkable/shareable.
export default function FilterBar({
  action,
  q,
  placeholder = "Search…",
  hidden = {},
  selects = [],
  clearHref,
}: {
  action: string;
  q: string;
  placeholder?: string;
  hidden?: Record<string, string>;
  selects?: Select[];
  clearHref: string;
}) {
  const active = Boolean(q) || selects.some((s) => s.value);

  return (
    <form
      method="get"
      action={action}
      className="mb-4 flex flex-wrap items-end gap-2"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="input sm:w-72"
      />
      {selects.map((s) => (
        <SubmitOnChange
          key={s.name}
          name={s.name}
          value={s.value}
          options={s.options}
          className="input sm:w-48"
        />
      ))}
      <button type="submit" className="btn-secondary">
        Search
      </button>
      {active && (
        <a href={clearHref} className="btn-secondary">
          Clear
        </a>
      )}
    </form>
  );
}
