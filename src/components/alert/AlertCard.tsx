interface AlertCardProps {
  alert: {
    id: string;
    doctor_name: string | null;
    postal_code: string | null;
    radius_km: number;
    created_at: string;
  };
  onDelete: (id: string) => void;
}

export function AlertCard({ alert, onDelete }: AlertCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4">
      <div>
        <p className="font-medium">
          {alert.doctor_name ?? `Any doctor near ${alert.postal_code}`}
        </p>
        <p className="text-sm text-zinc-500">
          Within {alert.radius_km}km · Created {new Date(alert.created_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onDelete(alert.id)}
        className="text-sm font-medium text-red-600 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
