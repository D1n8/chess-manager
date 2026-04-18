import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { AppUser, Tournament } from '../../types'
import './ProfilePage.css'

export default function ProfilePage({ onLogout }: { onLogout: () => void }) {
    const [history, setHistory] = useState<Tournament[]>([])
    const user: AppUser = JSON.parse(localStorage.getItem('user')!)

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('participants')
            .select('tournaments(id, title, city, start_date)')
            .eq('player_id', user.id)

        if (data) {
            const parsedTournaments = data.map((item: any) => item.tournaments)
            setHistory(parsedTournaments)
        }
    }

    useEffect(() => {
        if (user.role === 'player') fetchHistory()
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('user')
        onLogout()
    }

    return (
        <div className="container">
            <div className="profile-card">
                <h2>Личный кабинет</h2>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Роль:</strong> {user.role === 'organizer' ? 'Организатор' : 'Игрок'}</p>
                <p><strong>ФИО:</strong> {user.full_name}</p>

                {user.role === 'player' && (
                    <>
                        <p><strong>Возраст:</strong> {user.age} лет</p>
                        <p><strong>Рейтинг:</strong> {user.rating}</p>
                    </>
                )}

                <button className="btn-primary" style={{ marginTop: '20px' }} onClick={handleLogout}>
                    Выйти из аккаунта
                </button>
            </div>

            {user.role === 'player' && (
                <div>
                    <h2 style={{ color: '#660000', marginBottom: '15px' }}>История турниров</h2>
                    {history.length === 0 ? (
                        <p>Вы еще не принимали участие в турнирах.</p>
                    ) : (
                        <ul className="history-list">
                            {history.map((t, index) => (
                                <li key={index} className="history-item">
                                    <strong>{t.title}</strong> — г. {t.city} ({t.start_date})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}