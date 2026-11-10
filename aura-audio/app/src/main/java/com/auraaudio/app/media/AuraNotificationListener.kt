package com.auraaudio.app.media

import android.service.notification.NotificationListenerService

/**
 * Serviço vazio exigido pelo Android para que o app possa consultar
 * MediaSessionManager.getActiveSessions (metadados e estado dos players).
 * O usuário habilita em: Ajustes > Notificações > Acesso a notificações.
 */
class AuraNotificationListener : NotificationListenerService()
