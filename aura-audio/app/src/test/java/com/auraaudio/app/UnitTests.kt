package com.auraaudio.app

import com.auraaudio.app.audio.EqPresets
import com.auraaudio.app.bluetooth.Tw982
import com.auraaudio.app.data.EqProfileCodec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Tw982MatchTest {
    @Test fun `reconhece nomes oficiais`() {
        assertTrue(Tw982.matches("HAVIT TW982"))
        assertTrue(Tw982.matches("TW982"))
        assertTrue(Tw982.matches("LIFE 01T"))
        assertTrue(Tw982.matches("havit tw982 "))
    }
    @Test fun `rejeita outros dispositivos`() {
        assertFalse(Tw982.matches("AirPods Pro"))
        assertFalse(Tw982.matches("TW958"))
        assertFalse(Tw982.matches(null))
        assertFalse(Tw982.matches(""))
    }
}

class EqPresetsTest {
    @Test fun `curva original e plana`() {
        val original = EqPresets.byName("Original")!!
        listOf(60, 230, 910, 3600, 14000, 500, 8000).forEach {
            assertEquals(0f, EqPresets.gainAt(original, it), 0.01f)
        }
    }
    @Test fun `interpolacao dentro da faixa`() {
        val bass = EqPresets.byName("Deep Bass")!!
        val at60 = EqPresets.gainAt(bass, 60)
        val at230 = EqPresets.gainAt(bass, 230)
        val mid = EqPresets.gainAt(bass, 120)
        assertEquals(5f, at60, 0.01f)
        assertEquals(3f, at230, 0.01f)
        assertTrue(mid < at60 && mid > at230)
    }
    @Test fun `fora da faixa usa extremos`() {
        val rock = EqPresets.byName("Rock")!!
        assertEquals(4f, EqPresets.gainAt(rock, 10), 0.01f)
        assertEquals(3.5f, EqPresets.gainAt(rock, 20000), 0.01f)
    }
    @Test fun `todos os 14 presets existem`() {
        assertEquals(14, EqPresets.all.size)
        assertEquals(EqPresets.all.map { it.name }.toSet().size, EqPresets.all.size)
    }
}

class EqProfileCodecTest {
    @Test fun `roundtrip de perfis`() {
        val list = listOf(
            EqProfileCodec.Profile("Meu Som", listOf(300, -150, 0, 450, 600), 500, 200, 100),
            EqProfileCodec.Profile("Noite", listOf(-100, 0, 100), 0, 0, 0)
        )
        val decoded = EqProfileCodec.decode(EqProfileCodec.encode(list))
        assertEquals(list, decoded)
    }
    @Test fun `entrada corrompida nao quebra`() {
        assertTrue(EqProfileCodec.decode("lixo§sem§formato").isEmpty())
        assertTrue(EqProfileCodec.decode("").isEmpty())
    }
}
