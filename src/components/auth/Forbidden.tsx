import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div>
        <p className="text-xs font-semibold uppercase text-neutral-500 tracking-widest">
          Error 403
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold">
          Akses ditolak
        </h1>
      </div>
      <p className="max-w-md text-sm text-neutral-500">
        Anda tidak memiliki izin untuk mengakses halaman ini. Jika Anda merasa ini
        sebuah kesalahan, silakan hubungi administrator.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

