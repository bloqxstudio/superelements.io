<?php
/**
 * Plugin Name: Superelements Connector
 * Description: Deixa a plataforma Superelements gravar o título, a descrição e a palavra-chave do Yoast SEO em páginas, pela API do WordPress.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Superelements
 * License: GPLv2 or later
 *
 * O Yoast só expõe esses campos na API para posts. Aqui eles ficam expostos
 * também nas páginas e nos outros tipos públicos, com a mesma regra do Yoast:
 * só grava quem pode editar o conteúdo.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const SUPERELEMENTS_CONNECTOR_VERSION = '0.1.0';

add_action(
	'init',
	function () {
		if ( ! defined( 'WPSEO_VERSION' ) ) {
			return;
		}
		foreach ( get_post_types( array( 'public' => true ) ) as $post_type ) {
			// Nos posts o próprio Yoast já registra; anexos não têm SEO de página.
			if ( in_array( $post_type, array( 'post', 'attachment' ), true ) ) {
				continue;
			}
			foreach ( array( 'title', 'metadesc', 'focuskw' ) as $key ) {
				register_post_meta(
					$post_type,
					'_yoast_wpseo_' . $key,
					array(
						'show_in_rest'  => true,
						'single'        => true,
						'type'          => 'string',
						'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
							return current_user_can( 'edit_post', $post_id );
						},
					)
				);
			}
		}
	},
	20
);

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'superelements/v1',
			'/status',
			array(
				'methods'             => 'GET',
				'permission_callback' => function () {
					return current_user_can( 'edit_pages' );
				},
				'callback'            => function () {
					return array(
						'version' => SUPERELEMENTS_CONNECTOR_VERSION,
						'yoast'   => defined( 'WPSEO_VERSION' ) ? WPSEO_VERSION : null,
					);
				},
			)
		);
	}
);
