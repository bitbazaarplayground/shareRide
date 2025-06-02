import { useEffect, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

const AdminDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();

  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || role !== "admin") return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          { data: usersData, error: usersError },
          { data: ridesData, error: ridesError },
        ] = await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("rides").select("*"),
        ]);

        if (usersError || ridesError) {
          throw usersError || ridesError;
        }

        setUsers(usersData);
        setRides(ridesData);
      } catch (err) {
        setError("Failed to fetch admin data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, role]);

  // 🔄 Wait until auth state is ready
  if (authLoading) return <div className="p-4">Checking permissions...</div>;

  // ❌ Block non-admin access
  if (!user || role !== "admin") {
    return <div className="p-4 text-red-500">Access Denied. Admins only.</div>;
  }

  if (loading) return <div className="p-4">Loading data...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">All Users</h2>
        <ul className="bg-gray-100 p-4 rounded">
          {users.map((u) => (
            <li key={u.id} className="mb-2">
              {u.email} — {u.role}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">All Rides</h2>
        <ul className="bg-gray-100 p-4 rounded">
          {rides.map((ride) => (
            <li key={ride.id} className="mb-2">
              From {ride.start_location} to {ride.end_location} — Posted by User
              ID: {ride.user_id}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminDashboard;
