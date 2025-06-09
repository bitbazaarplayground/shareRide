import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { db } from "../firebase";

export default function AdminDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || role !== "admin") return;

    const fetchData = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const ridesSnapshot = await getDocs(collection(db, "rides"));

        setUsers(
          usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setRides(
          ridesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (err) {
        console.error("Error fetching admin data:", err);
        setError("Failed to fetch admin data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, role]);

  if (authLoading) return <p>Checking permissions...</p>;
  if (!user || role !== "admin") return <p>Access Denied. Admins only.</p>;
  if (loading) return <p>Loading data...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      <section>
        <h2 className="text-xl font-semibold">All Users</h2>
        <ul>
          {users.map((u) => (
            <li key={u.id}>
              {u.email} — {u.role}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">All Rides</h2>
        <ul>
          {rides.map((r) => (
            <li key={r.id}>
              From {r.start_location} to {r.end_location} — User ID: {r.user_id}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
