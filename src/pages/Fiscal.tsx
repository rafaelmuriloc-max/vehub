export default function Fiscal() {
  return (
    <div className="w-full h-[calc(100vh-7rem)]">
      <iframe
        src="https://app.monitorcontabil.com.br/"
        className="w-full h-full border-0 rounded-lg"
        allow="clipboard-write"
        title="Monitor Contábil"
      />
    </div>
  );
}
