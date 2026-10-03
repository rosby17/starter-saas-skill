export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">We&apos;ll be back shortly</h1>
      <p className="text-gray-600 max-w-md">
        {"{{APP_NAME}}"} is currently undergoing scheduled maintenance. Please check back soon.
      </p>
    </main>
  );
}
