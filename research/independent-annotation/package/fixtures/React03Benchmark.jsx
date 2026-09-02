function Profile() {
  const [user, setUser] = useState({ name: 'Old Name' });
  function rename() {
    user.name = 'New Name';
    setUser(user);
  }
  return <button onClick={rename}>{user.name}</button>;
}
