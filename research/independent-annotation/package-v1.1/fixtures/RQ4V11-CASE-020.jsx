function Profile({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, []);
  return <div>{userId}</div>;
}
